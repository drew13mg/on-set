import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCurrentProject } from "@/lib/projects-store";
import { shotLabel, trackerRows, type TrackerShot } from "@/lib/shots";
import { useShotLists } from "@/lib/shots-store";
import { useSyncStatus } from "@/lib/sync/SyncProvider";
import { useNow } from "@/lib/useNow";
import { formatTimeOfDay } from "@/lib/clips";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const DONE = colors.record;
const ACTIVE = colors.markIn;

function ShotCell({ shot, color }: { shot: TrackerShot; color: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.cellText, { color }]} numberOfLines={3}>
        {shotLabel(shot)}
      </Text>
      {shot.at ? <Text style={styles.cellTime}>{formatTimeOfDay(shot.at).slice(0, 5)}</Text> : null}
    </View>
  );
}

/** Live view across every shot list: title, last shot done, and what's active now. Updates as the team marks shots. */
export default function ShotTracker() {
  const { id: projectId } = useCurrentProject();
  const { lists, shots } = useShotLists(projectId);
  const rows = useMemo(() => trackerRows(lists, shots, projectId), [lists, shots, projectId]);
  const now = useNow();
  const status = useSyncStatus();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.live}>
          <View style={[styles.liveDot, status.error && { backgroundColor: colors.markOut }]} />
          <Text style={[type.label, { color: status.error ? colors.markOut : colors.text }]}>{status.error ? "Offline" : "Live"}</Text>
        </View>
        <Text style={[type.time, { color: colors.muted }]}>{formatTimeOfDay(now)}</Text>
      </View>

      {/* Column headings */}
      <View style={[styles.row, styles.headRow]}>
        <Text style={[type.label, styles.colList]}>Shot list</Text>
        <Text style={[type.label, styles.col, { color: DONE }]}>Last done</Text>
        <Text style={[type.label, styles.col, { color: ACTIVE }]}>Active</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        {rows.length === 0 ? (
          <Text style={[type.body, styles.empty]}>No shot lists yet. Make one on the Shot List page and mark shots to see them here.</Text>
        ) : null}
        {rows.map((r) => (
          <Pressable
            key={r.listId}
            onPress={() => router.push({ pathname: "/project/[id]/shot-list/[sid]", params: { id: projectId, sid: r.listId } })}
            style={({ pressed }) => [styles.row, styles.bodyRow, r.started && styles.startedRow, pressed && { backgroundColor: colors.surfaceRaised }]}
            accessibilityRole="button"
            accessibilityLabel={`${r.listName}. Last done: ${r.lastDone ? shotLabel(r.lastDone) : "none"}. Active: ${r.active.length ? r.active.map(shotLabel).join(", ") : "none"}.`}
          >
            <View style={[styles.colList, { gap: 4 }]}>
              <Text style={styles.listName} numberOfLines={3}>
                {r.listName}
              </Text>
              {r.started ? (
                <View style={styles.startedBadge}>
                  <Text style={styles.startedText}>STARTED</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.col}>{r.lastDone ? <ShotCell shot={r.lastDone} color={colors.text} /> : <Text style={styles.none}>—</Text>}</View>
            <View style={[styles.col, { gap: space.sm }]}>
              {r.active.length ? r.active.map((a) => <ShotCell key={a.number} shot={a} color={ACTIVE} />) : <Text style={styles.none}>—</Text>}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  live: { flexDirection: "row", alignItems: "center", gap: space.xs + 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.record },
  row: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg },
  headRow: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bodyRow: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  startedRow: { backgroundColor: "rgba(52, 211, 153, 0.07)" },
  colList: { flex: 1.15 },
  col: { flex: 1 },
  listName: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 19, color: colors.text },
  startedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: "rgba(52, 211, 153, 0.18)",
  },
  startedText: { color: ACTIVE, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  cellText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  cellTime: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, fontVariant: ["tabular-nums"] },
  none: { fontFamily: fonts.regular, fontSize: 14, color: colors.faint },
  empty: { color: colors.muted, textAlign: "center", padding: space.xl },
});
