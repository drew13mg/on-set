import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { useClips } from "@/lib/clips-store";
import { useProjects } from "@/lib/projects-store";
import { defaultProjectName, friendlyDate, type Project } from "@/lib/projects";
import { colors, radius, space, type } from "@/lib/theme";

type Dialog =
  | { kind: "new" }
  | { kind: "menu"; project: Project }
  | { kind: "rename"; project: Project }
  | { kind: "confirmDelete"; project: Project }
  | null;

/** "today", "yesterday", "Sep 12" */
const openedLabel = (ms: number) => {
  const d = friendlyDate(ms);
  return d === "Today" || d === "Yesterday" ? d.toLowerCase() : d;
};

const deleteMessage = (clips: number) =>
  clips > 0
    ? `This also deletes its ${clips === 1 ? "clip" : `${clips} clips`} and saved location. This can't be undone.`
    : "This can't be undone.";

/** First screen: start a new project or open / rename / delete an existing one. */
export default function Projects() {
  const { projects, loaded, addProject, renameProject, removeProject, touchProject } = useProjects();
  const { clips } = useClips();
  const [dialog, setDialog] = useState<Dialog>(null);

  const open = (p: Project) => {
    touchProject(p.id);
    router.push({ pathname: "/project/[id]", params: { id: p.id } });
  };

  const clipCount = (id: string) => clips.filter((c) => c.projectId === id).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={type.title}>ON SET</Text>
      </View>

      <Pressable
        onPress={() => setDialog({ kind: "new" })}
        style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={styles.plus}>+</Text>
        <Text style={[type.button, { color: colors.bg }]}>New project</Text>
      </Pressable>

      <Text style={[type.label, styles.section]}>Projects</Text>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loaded ? (
            <Text style={[type.body, styles.empty]}>
              No projects yet. Start one for each production, and its clips and locations stay together.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const n = clipCount(item.id);
          return (
            <Pressable
              onPress={() => open(item)}
              onLongPress={() => setDialog({ kind: "menu", project: item })}
              delayLongPress={350}
              style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceRaised }]}
              accessibilityRole="button"
              accessibilityHint="Opens the project. Press and hold to rename or delete."
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.heading} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={type.small}>
                  {n === 1 ? "1 clip" : `${n} clips`} · Opened {openedLabel(item.updatedAt)}
                </Text>
              </View>
              <Text style={[type.heading, { color: colors.faint }]}>›</Text>
            </Pressable>
          );
        }}
      />
      {projects.length ? <Text style={[type.small, styles.hint]}>Press and hold a project to rename or delete</Text> : null}

      <PromptModal
        visible={dialog?.kind === "new"}
        title="New project"
        placeholder={defaultProjectName(projects)}
        saveLabel="Create"
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          const p = addProject(name);
          setDialog(null);
          open(p);
        }}
      />

      <ActionSheet
        visible={dialog?.kind === "menu"}
        title={dialog?.kind === "menu" ? dialog.project.name : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "menu"
            ? [
                { label: "Rename", onPress: () => setDialog({ kind: "rename", project: dialog.project }) },
                { label: "Delete", destructive: true, onPress: () => setDialog({ kind: "confirmDelete", project: dialog.project }) },
              ]
            : []
        }
      />

      <PromptModal
        visible={dialog?.kind === "rename"}
        title="Rename project"
        initialValue={dialog?.kind === "rename" ? dialog.project.name : ""}
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          if (dialog?.kind === "rename") renameProject(dialog.project.id, name);
          setDialog(null);
        }}
      />

      <ActionSheet
        visible={dialog?.kind === "confirmDelete"}
        title={dialog?.kind === "confirmDelete" ? `Delete "${dialog.project.name}"?` : undefined}
        message={dialog?.kind === "confirmDelete" ? deleteMessage(clipCount(dialog.project.id)) : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmDelete"
            ? [
                {
                  label: "Delete project",
                  destructive: true,
                  onPress: () => {
                    removeProject(dialog.project.id);
                    setDialog(null);
                  },
                },
              ]
            : []
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  header: { paddingTop: space.xl, paddingBottom: space.xl },
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
  section: { marginTop: space.xl, marginBottom: space.md },
  list: { gap: space.md, paddingBottom: space.lg, flexGrow: 1 },
  empty: { color: colors.muted, textAlign: "center", marginTop: space.xl, paddingHorizontal: space.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  hint: { textAlign: "center", color: colors.faint, paddingVertical: space.sm },
});
