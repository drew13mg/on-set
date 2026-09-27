import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { PhotoImage } from "@/components/PhotoImage";
import { PromptModal } from "@/components/PromptModal";
import { useCurrentProject } from "@/lib/projects-store";
import { defaultLocationName, liveNotes, livePhotos, locationSummary } from "@/lib/scouting";
import { useLocations } from "@/lib/scouting-store";
import type { LocationRow } from "@/lib/sync/model";
import { friendlyDate } from "@/lib/projects";
import { colors, radius, space, type } from "@/lib/theme";

type Dialog = { kind: "new" } | { kind: "menu"; loc: LocationRow } | { kind: "rename"; loc: LocationRow } | { kind: "confirmDelete"; loc: LocationRow } | null;

/** The project's scouted locations. */
export default function Locations() {
  const { id: projectId } = useCurrentProject();
  const { locations, photos, notes, add, rename, remove } = useLocations(projectId);
  const [dialog, setDialog] = useState<Dialog>(null);

  const open = (loc: { id: string }) =>
    router.push({ pathname: "/project/[id]/location/[lid]", params: { id: projectId, lid: loc.id } });

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={locations}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            <Pressable onPress={() => setDialog({ kind: "new" })} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <Text style={styles.plus}>+</Text>
              <Text style={[type.button, { color: colors.bg }]}>New location</Text>
            </Pressable>
            {locations.length ? <Text style={type.label}>Locations</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>
            Add each place you scout. Keep up to 10 photos and as many notes as you need, shared with everyone on the project.
          </Text>
        }
        renderItem={({ item }) => {
          const ph = livePhotos(photos, item.id);
          const n = liveNotes(notes, item.id).length;
          return (
            <Pressable
              onPress={() => open(item)}
              onLongPress={() => setDialog({ kind: "menu", loc: item })}
              delayLongPress={350}
              style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceRaised }]}
              accessibilityRole="button"
              accessibilityHint="Opens the location. Press and hold to rename or delete."
            >
              {ph[0] ? (
                <PhotoImage photo={ph[0]} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverEmpty]}>
                  <Text style={[type.label, { color: colors.faint }]}>No photos</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.heading} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={type.small}>{locationSummary(ph.length, n)}</Text>
                <Text style={[type.small, { color: colors.faint }]}>Added {friendlyDate(item.createdAt).toLowerCase()}</Text>
              </View>
              <Text style={[type.heading, { color: colors.faint }]}>›</Text>
            </Pressable>
          );
        }}
      />
      {locations.length ? <Text style={[type.small, styles.hint]}>Press and hold a location to rename or delete</Text> : null}

      <PromptModal
        visible={dialog?.kind === "new"}
        title="New location"
        message="Name it so the crew knows the place, e.g. “Rooftop – 5th & Main”."
        placeholder={defaultLocationName(locations)}
        saveLabel="Create"
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          const loc = add(name);
          setDialog(null);
          open(loc);
        }}
      />
      <ActionSheet
        visible={dialog?.kind === "menu"}
        title={dialog?.kind === "menu" ? dialog.loc.name : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "menu"
            ? [
                { label: "Rename", onPress: () => setDialog({ kind: "rename", loc: dialog.loc }) },
                { label: "Delete", destructive: true, onPress: () => setDialog({ kind: "confirmDelete", loc: dialog.loc }) },
              ]
            : []
        }
      />
      <PromptModal
        visible={dialog?.kind === "rename"}
        title="Rename location"
        initialValue={dialog?.kind === "rename" ? dialog.loc.name : ""}
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          if (dialog?.kind === "rename") rename(dialog.loc.id, name);
          setDialog(null);
        }}
      />
      <ActionSheet
        visible={dialog?.kind === "confirmDelete"}
        title={dialog?.kind === "confirmDelete" ? `Delete "${dialog.loc.name}"?` : undefined}
        message="Deletes its photos and notes for everyone on the project. This can't be undone."
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmDelete"
            ? [{ label: "Delete location", destructive: true, onPress: () => { remove(dialog.loc.id); setDialog(null); } }]
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.md,
  },
  cover: { width: 72, height: 72, borderRadius: radius.md },
  coverEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  hint: { textAlign: "center", color: colors.faint, paddingVertical: space.sm },
});
