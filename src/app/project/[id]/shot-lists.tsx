import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { useCurrentProject } from "@/lib/projects-store";
import { defaultListName, duplicateName, listProgress, progressLabel } from "@/lib/shots";
import { useShotLists } from "@/lib/shots-store";
import type { ShotListRow } from "@/lib/sync/model";
import { formatTimeOfDay } from "@/lib/clips";
import { colors, radius, space, type } from "@/lib/theme";

type Dialog =
  | { kind: "new" }
  | { kind: "menu"; list: ShotListRow }
  | { kind: "rename"; list: ShotListRow; title: string; message?: string }
  | { kind: "confirmDelete"; list: ShotListRow }
  | null;

/** A project's shot lists: start a new one or open one to edit. */
export default function ShotLists() {
  const { id: projectId } = useCurrentProject();
  const { lists, shots, add, rename, remove, duplicate } = useShotLists(projectId);
  const [dialog, setDialog] = useState<Dialog>(null);

  const open = (l: { id: string }) => router.push({ pathname: "/project/[id]/shot-list/[sid]", params: { id: projectId, sid: l.id } });

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={lists}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            <Pressable onPress={() => setDialog({ kind: "new" })} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <Text style={styles.plus}>+</Text>
              <Text style={[type.button, { color: colors.bg }]}>New shot list</Text>
            </Pressable>
            {lists.length ? <Text style={type.label}>Shot lists</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>
            Make a list for each day or scene. Add numbered shots, then mark them active and done as you shoot.
          </Text>
        }
        renderItem={({ item }) => {
          const p = listProgress(shots, item.id);
          const active = item.startedAt != null;
          return (
            <Pressable
              onPress={() => open(item)}
              onLongPress={() => setDialog({ kind: "menu", list: item })}
              delayLongPress={350}
              style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && { backgroundColor: colors.surfaceRaised }]}
              accessibilityRole="button"
              accessibilityHint="Opens the list. Press and hold to rename, duplicate or delete."
            >
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={[type.heading, { flexShrink: 1 }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {active ? (
                    <View style={styles.activeBadge}>
                      <View style={styles.dot} />
                      <Text style={styles.activeText}>ACTIVE</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={type.small}>{progressLabel(p)}</Text>
                {active ? <Text style={[type.small, { color: colors.markIn }]}>Started {formatTimeOfDay(item.startedAt!).slice(0, 5)}</Text> : null}
              </View>
              {p.total ? (
                <View style={styles.meter}>
                  <View style={[styles.meterFill, { width: `${(p.done / p.total) * 100}%` }]} />
                </View>
              ) : null}
              <Text style={[type.heading, { color: colors.faint }]}>›</Text>
            </Pressable>
          );
        }}
      />
      {lists.length ? <Text style={[type.small, styles.hint]}>Press and hold a list to rename, duplicate or delete</Text> : null}

      <PromptModal
        visible={dialog?.kind === "new"}
        title="New shot list"
        placeholder={defaultListName(lists)}
        saveLabel="Create"
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          const l = add(name);
          setDialog(null);
          open(l);
        }}
      />

      <ActionSheet
        visible={dialog?.kind === "menu"}
        title={dialog?.kind === "menu" ? dialog.list.name : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "menu"
            ? [
                { label: "Edit name", onPress: () => setDialog({ kind: "rename", list: dialog.list, title: "Rename shot list" }) },
                {
                  label: "Duplicate",
                  onPress: () => {
                    const copy = duplicate(dialog.list.id, duplicateName(dialog.list.name, lists));
                    // Straight away, offer to name the copy.
                    if (copy) setDialog({ kind: "rename", list: copy, title: "Name the copy", message: `Duplicated "${dialog.list.name}" with its shots, all unchecked.` });
                    else setDialog(null);
                  },
                },
                { label: "Delete", destructive: true, onPress: () => setDialog({ kind: "confirmDelete", list: dialog.list }) },
              ]
            : []
        }
      />

      <PromptModal
        visible={dialog?.kind === "rename"}
        title={dialog?.kind === "rename" ? dialog.title : ""}
        message={dialog?.kind === "rename" ? dialog.message : undefined}
        initialValue={dialog?.kind === "rename" ? dialog.list.name : ""}
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          if (dialog?.kind === "rename") rename(dialog.list.id, name);
          setDialog(null);
        }}
      />

      <ActionSheet
        visible={dialog?.kind === "confirmDelete"}
        title={dialog?.kind === "confirmDelete" ? `Delete "${dialog.list.name}"?` : undefined}
        message="Deletes the list and all its shots for everyone on the project. This can't be undone."
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmDelete"
            ? [{ label: "Delete list", destructive: true, onPress: () => { remove(dialog.list.id); setDialog(null); } }]
            : []
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  newBtn: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  plus: { fontSize: 22, lineHeight: 24, color: colors.bg, fontWeight: "600" },
  empty: { color: colors.muted, textAlign: "center", marginTop: space.lg, paddingHorizontal: space.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardActive: { borderColor: colors.markIn },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.markIn },
  activeText: { color: colors.markIn, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  meter: { width: 44, height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.record },
  hint: { textAlign: "center", color: colors.faint, paddingVertical: space.sm },
});
