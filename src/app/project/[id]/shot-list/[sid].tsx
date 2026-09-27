import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { useCurrentProject } from "@/lib/projects-store";
import { ACTION_STATUS, COLUMNS, listProgress, MAX_SHOTS, progressLabel } from "@/lib/shots";
import { useShotList } from "@/lib/shots-store";
import type { ShotRow, ShotStatus } from "@/lib/sync/model";
import { formatTimeOfDay } from "@/lib/clips";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const GAP = space.sm;
const DONE = colors.record; // red
const ACTIVE = colors.markIn; // green

type Tile = { kind: "shot"; shot: ShotRow } | { kind: "add" };
type Dialog = { kind: "addMany" } | { kind: "shotMenu"; shot: ShotRow } | { kind: "confirmStop" } | null;

const tap = () => Haptics.selectionAsync().catch(() => {});

/** One shot list: numbered tiles 3 across (up to 120), Start at the top, Done / Active / Uncheck at the bottom. */
export default function ShotListScreen() {
  const { id: projectId } = useCurrentProject();
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { list, shots, addShots, setStatus, removeShot, start, stop } = useShotList(projectId, String(sid));
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<string | null>(null);

  const contentWidth = Math.min(width, 640) - space.lg * 2;
  const tile = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);
  const room = MAX_SHOTS - shots.length;
  const data: Tile[] = [...shots.map<Tile>((s) => ({ kind: "shot", shot: s })), ...(room > 0 ? [{ kind: "add" } as Tile] : [])];
  const selectedShot = shots.find((s) => s.id === selected);
  const progress = listProgress(shots, String(sid));
  const active = list?.startedAt != null;

  const add = (n: number) => {
    const added = addShots(n);
    setMessage(added < n ? `A list holds up to ${MAX_SHOTS} shots.` : null);
    tap();
  };

  const apply = (status: ShotStatus) => {
    if (!selectedShot) return;
    setStatus(selectedShot.id, status);
    tap();
  };

  if (!list) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={[type.body, { color: colors.muted, padding: space.lg }]}>This shot list no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: list.name }} />

      {/* Start (top): makes this the project's active shot list */}
      <View style={styles.top}>
        {active ? (
          <Pressable onPress={() => setDialog({ kind: "confirmStop" })} style={[styles.startBtn, styles.startBtnActive]} accessibilityRole="button" accessibilityLabel="Shot list is active. Tap to stop.">
            <View style={styles.liveDot} />
            <Text style={[type.button, { color: colors.bg }]}>Active · since {formatTimeOfDay(list.startedAt!).slice(0, 5)}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              start();
              tap();
            }}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={[type.button, { color: colors.bg }]}>Start</Text>
          </Pressable>
        )}
        <Text style={[type.small, styles.progress]}>{progressLabel(progress)}</Text>
      </View>

      {/* Tiles */}
      <FlatList
        data={data}
        key={`cols-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(t) => (t.kind === "shot" ? t.shot.id : "add")}
        contentContainerStyle={[styles.grid, { width: contentWidth + space.lg * 2 }]}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListEmptyComponent={null}
        ListFooterComponent={
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {message ? <Text style={[type.small, { color: colors.markOut }]}>{message}</Text> : null}
            {shots.length === 0 ? <Text style={[type.small, { color: colors.faint }]}>Tap + to add a shot. Hold + to add several at once.</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === "add") {
            return (
              <Pressable
                onPress={() => add(1)}
                onLongPress={() => setDialog({ kind: "addMany" })}
                delayLongPress={350}
                style={({ pressed }) => [styles.tile, styles.addTile, { width: tile, height: tile }, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Add shot"
                accessibilityHint="Hold to add several"
              >
                <Text style={styles.addPlus}>+</Text>
                <Text style={[type.label, { fontSize: 10 }]}>Add shot</Text>
              </Pressable>
            );
          }
          const s = item.shot;
          const isSel = s.id === selected;
          const bg = s.status === "done" ? DONE : s.status === "active" ? ACTIVE : colors.surface;
          const fg = s.status === "done" ? colors.text : s.status === "active" ? colors.bg : colors.text;
          return (
            <Pressable
              onPress={() => {
                setSelected(isSel ? null : s.id);
                tap();
              }}
              onLongPress={() => setDialog({ kind: "shotMenu", shot: s })}
              delayLongPress={450}
              style={[styles.tile, { width: tile, height: tile, backgroundColor: bg }, isSel && styles.tileSelected]}
              accessibilityRole="button"
              accessibilityLabel={`Shot ${s.number}${s.status === "none" ? "" : `, ${s.status}`}`}
              accessibilityState={{ selected: isSel }}
            >
              <Text style={[styles.number, { color: fg }]}>{s.number}</Text>
              {s.status !== "none" ? <Text style={[styles.status, { color: fg }]}>{s.status === "done" ? "DONE" : "ACTIVE"}</Text> : null}
            </Pressable>
          );
        }}
      />

      {/* Action buttons (bottom) */}
      <View style={styles.bar}>
        <Text style={[type.small, styles.barHint]}>
          {selectedShot ? `Shot ${selectedShot.number} selected` : shots.length ? "Tap a shot to select it" : " "}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => apply(ACTION_STATUS.done)}
            disabled={!selectedShot}
            style={({ pressed }) => [styles.action, { backgroundColor: DONE }, !selectedShot && styles.actionOff, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={[type.button, { color: colors.text }]}>Done</Text>
          </Pressable>
          <Pressable
            onPress={() => apply(ACTION_STATUS.active)}
            disabled={!selectedShot}
            style={({ pressed }) => [styles.action, { backgroundColor: ACTIVE }, !selectedShot && styles.actionOff, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={[type.button, { color: colors.bg }]}>Active</Text>
          </Pressable>
          <Pressable
            onPress={() => apply(ACTION_STATUS.uncheck)}
            disabled={!selectedShot}
            style={({ pressed }) => [styles.action, styles.uncheck, !selectedShot && styles.actionOff, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={[type.button, { color: colors.text }]}>Uncheck</Text>
          </Pressable>
        </View>
      </View>

      <PromptModal
        visible={dialog?.kind === "addMany"}
        title="Add shots"
        message={`How many? Up to ${room} more (a list holds ${MAX_SHOTS}).`}
        placeholder="10"
        saveLabel="Add"
        onCancel={() => setDialog(null)}
        onSave={(v) => {
          setDialog(null);
          const n = parseInt(v, 10);
          if (n > 0) add(n);
        }}
      />
      <ActionSheet
        visible={dialog?.kind === "shotMenu"}
        title={dialog?.kind === "shotMenu" ? `Shot ${dialog.shot.number}` : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "shotMenu"
            ? [
                {
                  label: "Delete shot",
                  destructive: true,
                  onPress: () => {
                    if (selected === dialog.shot.id) setSelected(null);
                    removeShot(dialog.shot);
                    setDialog(null);
                  },
                },
              ]
            : []
        }
      />
      <ActionSheet
        visible={dialog?.kind === "confirmStop"}
        title="Stop this shot list?"
        message="It will no longer be the project's active shot list. Shot marks stay as they are."
        onClose={() => setDialog(null)}
        actions={[{ label: "Stop", destructive: true, onPress: () => { stop(); setDialog(null); } }]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm },
  startBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  startBtnActive: { backgroundColor: ACTIVE },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.bg },
  progress: { textAlign: "center" },
  grid: { paddingHorizontal: space.lg, paddingBottom: space.xl, alignSelf: "center" },
  tile: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileSelected: { borderWidth: 4, borderColor: colors.text },
  addTile: { borderStyle: "dashed", borderWidth: 1.5, backgroundColor: "transparent", gap: 2 },
  addPlus: { fontSize: 30, lineHeight: 32, color: colors.text },
  number: { fontFamily: fonts.bold, fontSize: 34, fontVariant: ["tabular-nums"] },
  status: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 2 },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.sm,
  },
  barHint: { textAlign: "center" },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  uncheck: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  actionOff: { opacity: 0.35 },
});
