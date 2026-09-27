import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { PromptModal } from "@/components/PromptModal";
import { SettingsButton } from "@/components/SettingsButton";
import { useCurrentProject } from "@/lib/projects-store";
import { useSlate } from "@/lib/slate-store";
import { boardValues, SLATE_LABELS, SLATE_LIMITS, type SlateField } from "@/lib/slate";
import { useNow } from "@/lib/useNow";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const BOARD = "#0E0F11";
const CHALK = "#F4F5F2";
const LINE = "rgba(244, 245, 242, 0.85)";
const OPEN_ANGLE = -14; // how far the top stick swings open before it claps shut

/** One clapper stick: diagonal black and white stripes. */
function Stick({ width, height }: { width: number; height: number }) {
  const s = height * 1.25;
  const lean = height * 0.75;
  const stripes: string[] = [];
  for (let x = -lean, i = 0; x < width + lean; x += s, i++) {
    if (i % 2) continue;
    stripes.push(`M ${x + lean} 0 L ${x + lean + s} 0 L ${x + s} ${height} L ${x} ${height} Z`);
  }
  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id="stick">
          <Rect x={0} y={0} width={width} height={height} rx={3} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={3} fill={BOARD} />
      <Path d={stripes.join(" ")} fill={CHALK} clipPath="url(#stick)" />
      <Rect x={0.75} y={0.75} width={width - 1.5} height={height - 1.5} rx={3} fill="none" stroke={BOARD} strokeWidth={1.5} />
    </Svg>
  );
}

/** Largest font size (up to `max`) at which `text` fits on one line in `width`. Same on every platform. */
function fit(text: string, width: number, max: number): number {
  const chars = Math.max(text.length, 1);
  return Math.max(10, Math.min(max, width / (chars * 0.6)));
}

/** A labelled, tappable area of the board. */
function Cell({
  field,
  value,
  big,
  width,
  onEdit,
  style,
}: {
  field: SlateField;
  value: string;
  big: number;
  width: number;
  onEdit: (f: SlateField) => void;
  style?: object;
}) {
  return (
    <Pressable
      onPress={() => onEdit(field)}
      style={({ pressed }) => [styles.cell, style, pressed && { backgroundColor: "rgba(255,255,255,0.06)" }]}
      accessibilityRole="button"
      accessibilityLabel={`${SLATE_LABELS[field]}: ${value || "empty"}`}
      accessibilityHint="Tap to edit"
    >
      <Text style={[styles.label, { fontSize: Math.max(9, Math.min(big * 0.2, 14)) }]}>{SLATE_LABELS[field]}</Text>
      <View style={styles.valueWrap}>
        <Text
          style={[styles.value, { fontSize: fit(value || "—", width - 20, big), lineHeight: big * 1.08 }, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {value || "—"}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Clapboard: turns the phone sideways and shows a slate to hold up to camera.
 * Tap any part of the board to edit it; tap the sticks to clap.
 */
export default function Slate() {
  // Keep the screen on while the slate is up.
  useEffect(() => {
    const tag = "onset-slate";
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(tag))
        .catch(() => {});
    };
  }, []);
  const { id, project } = useCurrentProject();
  const { row, set, step } = useSlate(id);
  const now = useNow(60_000);
  const v = boardValues(row, project?.name ?? "", now);
  const [editing, setEditing] = useState<SlateField | null>(null);
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();

  // The screen is locked to landscape on phones. On the web (or anywhere it can't turn),
  // turn the board itself sideways when the window is taller than it is wide.
  const turn = Platform.OS === "web" && win.height > win.width;
  const W = turn ? win.height : win.width;
  const H = turn ? win.width : win.height;

  const rail = 64;
  const padX = Math.max(insets.left, insets.right, space.md);
  const padY = Math.max(insets.top, space.md);
  const availW = W - padX * 2 - rail * 2;
  const availH = H - padY - Math.max(insets.bottom, space.md);
  const ASPECT = 1.62;
  const boardW = Math.min(availW, availH * ASPECT);
  const boardH = boardW / ASPECT;
  const stickH = boardH * 0.13;
  const bodyH = boardH - stickH * 2 - 4;
  const titleSize = bodyH * 0.19;
  const midSize = bodyH * 0.27;
  const footSize = bodyH * 0.1;

  // Clap: the top stick swings open, then snaps shut (sticks rest closed so the board can be as big as possible).
  const angle = useSharedValue(0);
  const stickStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const clap = () => {
    angle.value = withSequence(
      withTiming(OPEN_ANGLE, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(OPEN_ANGLE, { duration: 350 }),
      withTiming(0, { duration: 90, easing: Easing.in(Easing.quad) }),
    );
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 660);
  };

  const content = (
    <View style={[styles.stage, { width: W, height: H, paddingLeft: padX, paddingRight: padX, paddingTop: padY }]}>
      {/* Left rail: back */}
      <View style={[styles.rail, { width: rail }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.round} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
      </View>

      {/* The board */}
      <View style={{ width: boardW, height: boardH }}>
        <Pressable onPress={clap} accessibilityRole="button" accessibilityLabel="Clap" accessibilityHint="Snaps the clapper sticks shut">
          <Animated.View style={[{ width: boardW, height: stickH, transformOrigin: "0% 100%" }, stickStyle]}>
            <Stick width={boardW} height={stickH} />
          </Animated.View>
          <View style={{ height: 2 }} />
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <Stick width={boardW} height={stickH} />
          </View>
        </Pressable>
        <View style={[styles.body, { height: bodyH, marginTop: 2 }]}>
          <Cell field="title" value={v.title} big={titleSize} width={boardW} onEdit={setEditing} style={{ flex: 30 }} />
          <View style={[styles.row, styles.rule, { flex: 43 }]}>
            <Cell field="roll" value={v.roll} big={midSize} width={boardW / 3} onEdit={setEditing} style={styles.col} />
            <Cell field="scene" value={v.scene} big={midSize} width={boardW / 3} onEdit={setEditing} style={[styles.col, styles.colRule]} />
            <Cell field="take" value={v.take} big={midSize} width={boardW / 3} onEdit={setEditing} style={[styles.col, styles.colRule]} />
          </View>
          <View style={[styles.row, styles.rule, { flex: 27 }]}>
            <Cell field="date" value={v.date} big={footSize} width={boardW / 3} onEdit={setEditing} style={styles.col} />
            <Cell field="producer" value={v.producer} big={footSize} width={boardW / 3} onEdit={setEditing} style={[styles.col, styles.colRule]} />
            <Cell field="director" value={v.director} big={footSize} width={boardW / 3} onEdit={setEditing} style={[styles.col, styles.colRule]} />
          </View>
        </View>
      </View>

      {/* Right rail: settings, next / previous take */}
      <View style={[styles.rail, { width: rail, alignItems: "flex-end" }]}>
        <View style={styles.round}>
          <SettingsButton projectId={id} />
        </View>
        <View style={styles.takeCtl}>
          <Text style={[type.label, { fontSize: 10, letterSpacing: 1 }]}>Take</Text>
          <Pressable onPress={() => { step(1); Haptics.selectionAsync().catch(() => {}); }} style={styles.round} accessibilityRole="button" accessibilityLabel="Next take">
            <Text style={styles.stepText}>+</Text>
          </Pressable>
          <Pressable onPress={() => { step(-1); Haptics.selectionAsync().catch(() => {}); }} style={styles.round} accessibilityRole="button" accessibilityLabel="Previous take">
            <Text style={styles.stepText}>−</Text>
          </Pressable>
        </View>
        <View style={{ height: 44 }} />
      </View>
    </View>
  );

  return (
    <View style={styles.safe}>
      <StatusBar hidden />
      {turn ? (
        <View style={[styles.turned, { width: W, height: H, left: (win.width - W) / 2, top: (win.height - H) / 2 }]}>{content}</View>
      ) : (
        content
      )}

      <PromptModal
        visible={editing != null}
        title={editing ? SLATE_LABELS[editing] : ""}
        message={editing === "date" ? "Leave empty to always show today's date." : editing === "title" ? "Leave empty to use the project name." : undefined}
        initialValue={editing ? (editing === "date" ? row?.date ?? "" : editing === "title" ? row?.title ?? "" : v[editing]) : ""}
        placeholder={editing === "date" ? v.date : editing === "title" ? project?.name : undefined}
        maxLength={editing ? SLATE_LIMITS[editing] : undefined}
        onCancel={() => setEditing(null)}
        onSave={(value) => {
          if (editing) set(editing, value);
          setEditing(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  turned: { position: "absolute", transform: [{ rotate: "90deg" }] },
  stage: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  rail: { alignSelf: "stretch", justifyContent: "space-between", paddingBottom: space.md },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { color: colors.text, fontSize: 22, lineHeight: 24 },
  takeCtl: { alignItems: "center", gap: space.sm },
  stepText: { color: colors.text, fontSize: 24, lineHeight: 26, fontFamily: fonts.bold },
  body: {
    backgroundColor: BOARD,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: BOARD,
    overflow: "hidden",
  },
  row: { flexDirection: "row" },
  rule: { borderTopWidth: 2, borderTopColor: LINE },
  col: { flex: 1 },
  colRule: { borderLeftWidth: 2, borderLeftColor: LINE },
  cell: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 2 },
  label: { fontFamily: fonts.bold, color: "rgba(244, 245, 242, 0.7)", letterSpacing: 1.5, textTransform: "uppercase" },
  valueWrap: { flex: 1, justifyContent: "center" },
  value: { fontFamily: fonts.bold, color: CHALK, textAlign: "center", fontVariant: ["tabular-nums"] },
  placeholder: { color: "rgba(244, 245, 242, 0.25)" },
});
