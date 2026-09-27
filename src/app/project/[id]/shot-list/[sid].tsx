import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { ScheduleGraph } from "@/components/ScheduleGraph";
import { useCurrentProject } from "@/lib/projects-store";
import {
  ACTION_STATUS,
  buildSchedule,
  COLUMNS,
  formatMinutes,
  listProgress,
  MAX_SHOTS,
  MAX_TITLE,
  nowOnSchedule,
  parseTimeOfDay,
  progressLabel,
  suggestTime,
} from "@/lib/shots";
import { useNow } from "@/lib/useNow";
import { useShotList } from "@/lib/shots-store";
import type { ShotRow, ShotStatus } from "@/lib/sync/model";
import { formatTimeOfDay } from "@/lib/clips";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const GAP = space.sm;
const DONE = colors.record; // red
const ACTIVE = colors.markIn; // green

type Tile = { kind: "shot"; shot: ShotRow } | { kind: "add" };
type Dialog =
  | { kind: "addMany" }
  | { kind: "shotMenu"; shot: ShotRow }
  | { kind: "title"; shot: ShotRow }
  | { kind: "time"; shot: ShotRow; value: string; error?: string }
  | { kind: "confirmStop" }
  | null;

const tap = () => Haptics.selectionAsync().catch(() => {});

/** The time sits top-centre; on narrow tiles, nudge it right just enough to clear a long shot number. */
function timeNudge(tile: number, n: number): number {
  const numberWidth = String(n).length * 9 + 4;
  const room = (tile - space.sm * 2) / 2 - 19; // half the tile, less half the time's width
  return numberWidth > room ? (numberWidth - room) * 2 : 0;
}

/** One shot list: numbered tiles 3 across (up to 120), Start at the top, Done / Active / Uncheck at the bottom. */
export default function ShotListScreen() {
  const { id: projectId } = useCurrentProject();
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { list, shots, addShots, setStatus, setTitle, setTime, removeShot, start, stop } = useShotList(projectId, String(sid));
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

  // Schedule graph and "late" tiles, refreshed every 30 s.
  const now = useNow(30_000);
  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const schedule = useMemo(() => buildSchedule(shots), [shots]);
  const late = useMemo(() => {
    const ids = new Set<string>();
    if (!schedule || !active) return ids;
    const at = nowOnSchedule(schedule, nowMin);
    for (const i of schedule.items) if (i.status === "none" && i.start < at) ids.add(i.id);
    return ids;
  }, [schedule, active, nowMin]);

  const openTime = (shot: ShotRow) => {
    const current = shot.timeMin ?? suggestTime(shots, shot.number);
    setDialog({ kind: "time", shot, value: current == null ? "" : formatMinutes(current) });
  };

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
        <ScheduleGraph
          schedule={schedule}
          nowMin={nowMin}
          live={active}
          hasShots={shots.length > 0}
          selectedId={selected}
          onSelect={(id) => {
            setSelected(id);
            tap();
          }}
        />
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
            {shots.length === 0 ? (
              <Text style={[type.small, { color: colors.faint }]}>Tap + to add a shot. Hold + to add several at once.</Text>
            ) : (
              <Text style={[type.small, { color: colors.faint }]}>Hold a shot to give it a title (up to {MAX_TITLE} characters) or a time.</Text>
            )}
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
              style={[styles.tile, styles.shotTile, { width: tile, height: tile, backgroundColor: bg }, isSel && styles.tileSelected]}
              accessibilityRole="button"
              accessibilityLabel={`Shot ${s.number}${s.description ? `: ${s.description}` : ""}${s.timeMin != null ? `, at ${formatMinutes(s.timeMin)}` : ""}${s.status === "none" ? "" : `, ${s.status}`}`}
              accessibilityState={{ selected: isSel }}
            >
              <View style={styles.tileTop}>
                <Text style={[styles.number, { color: fg }]}>{s.number}</Text>
                {s.timeMin != null ? (
                  <Text style={[styles.time, { color: late.has(s.id) ? colors.markOut : fg, paddingLeft: timeNudge(tile, s.number) }]} numberOfLines={1}>
                    {formatMinutes(s.timeMin)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.titleWrap}>
                {s.description ? (
                  <Text style={[styles.title, { color: fg }]} numberOfLines={4}>
                    {s.description}
                  </Text>
                ) : null}
              </View>
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
        message={dialog?.kind === "shotMenu" && dialog.shot.description ? dialog.shot.description : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "shotMenu"
            ? [
                { label: dialog.shot.description ? "Edit title" : "Add title", onPress: () => setDialog({ kind: "title", shot: dialog.shot }) },
                { label: dialog.shot.timeMin != null ? `Change time (${formatMinutes(dialog.shot.timeMin)})` : "Set time", onPress: () => openTime(dialog.shot) },
                ...(dialog.shot.timeMin != null
                  ? [{ label: "Clear time", onPress: () => { setTime(dialog.shot.id, null); setDialog(null); } }]
                  : []),
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
      <PromptModal
        visible={dialog?.kind === "title"}
        title={dialog?.kind === "title" ? `Shot ${dialog.shot.number} title` : ""}
        placeholder="e.g. Wide – coach enters"
        initialValue={dialog?.kind === "title" ? dialog.shot.description : ""}
        maxLength={MAX_TITLE}
        onCancel={() => setDialog(null)}
        onSave={(v) => {
          if (dialog?.kind === "title") setTitle(dialog.shot.id, v);
          setDialog(null);
        }}
      />
      <PromptModal
        visible={dialog?.kind === "time"}
        title={dialog?.kind === "time" ? `Shot ${dialog.shot.number} time` : ""}
        message={dialog?.kind === "time" ? (dialog.error ?? "Time of day for this shot, e.g. 9:30, 2:15pm or 1415.") : undefined}
        placeholder="9:30"
        initialValue={dialog?.kind === "time" ? dialog.value : ""}
        saveLabel="Set"
        onCancel={() => setDialog(null)}
        onSave={(v) => {
          if (dialog?.kind !== "time") return;
          if (!v.trim()) {
            setTime(dialog.shot.id, null);
            setDialog(null);
            return;
          }
          const min = parseTimeOfDay(v);
          if (min == null) {
            setDialog({ ...dialog, value: v, error: `Couldn't read "${v.trim()}". Try 9:30, 2:15pm or 1415.` });
            return;
          }
          setTime(dialog.shot.id, min);
          setDialog(null);
        }}
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
  shotTile: { alignItems: "stretch", justifyContent: "flex-start", padding: space.sm },
  tileTop: { height: 18, justifyContent: "center" },
  number: { position: "absolute", left: 0, fontFamily: fonts.bold, fontSize: 14, fontVariant: ["tabular-nums"] },
  time: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.3, fontVariant: ["tabular-nums"], textAlign: "center" },
  titleWrap: { flex: 1, justifyContent: "center" },
  title: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, textAlign: "center" },
  status: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, textAlign: "center" },
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
