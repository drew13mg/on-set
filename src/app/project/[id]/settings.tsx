import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { SharePanel } from "@/components/SharePanel";
import { useAuth } from "@/lib/auth";
import { GroupAccessError, useCurrentProject, useProjects } from "@/lib/projects-store";
import { useSync, useSyncStatus } from "@/lib/sync/SyncProvider";
import { colors, radius, space, type } from "@/lib/theme";

/**
 * Project settings (the gear in the top-right of every project screen).
 * Sharing lives here so a project can be shared with more people at any time.
 * More project settings can be added as sections below.
 */
export default function ProjectSettings() {
  const { id, project } = useCurrentProject();
  const { me } = useAuth();
  const { engine } = useSync();
  const status = useSyncStatus();
  const { renameProject, removeProject } = useProjects();
  const [renaming, setRenaming] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Make sure a new project is uploaded before it can be shared.
  useEffect(() => {
    if (me && project && !project.isCloud) engine.sync();
  }, [me, project?.isCloud, engine]);

  if (!project) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={[type.body, { color: colors.muted, padding: space.lg }]}>This project no longer exists.</Text>
      </SafeAreaView>
    );
  }

  const leaveOrDelete = project.isOwner ? "Delete project" : "Leave project";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Project settings" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.title} numberOfLines={2}>
          {project.name}
        </Text>
        {!project.isOwner ? <Text style={type.small}>Shared with you</Text> : null}

        {/* Sharing */}
        <Text style={[type.heading, styles.section]}>Share</Text>
        {!me ? (
          <View style={styles.card}>
            <Text style={type.body}>Sign in to share this project. Everyone on it sees changes as they happen.</Text>
            <Pressable onPress={() => router.push("/account")} style={styles.primary}>
              <Text style={[type.button, { color: colors.bg }]}>Sign in</Text>
            </Pressable>
          </View>
        ) : !project.isCloud ? (
          <View style={[styles.card, styles.rowCard]}>
            {status.syncing || !status.error ? <ActivityIndicator color={colors.muted} /> : null}
            <Text style={[type.small, { flex: 1 }]}>
              {status.error ? "Can't upload the project yet. Check your connection; it will retry." : "Uploading the project so it can be shared…"}
            </Text>
          </View>
        ) : (
          <SharePanel projectId={id} projectName={project.name} isOwner={project.isOwner} />
        )}

        {/* Project */}
        <Text style={[type.heading, styles.section]}>Project</Text>
        <View style={styles.group}>
          <Pressable onPress={() => setRenaming(true)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text style={type.body}>Rename</Text>
            <Text style={[type.body, { color: colors.faint }]}>›</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmRemove(true)} style={({ pressed }) => [styles.item, styles.itemLast, pressed && styles.pressed]}>
            <Text style={[type.body, { color: colors.record }]}>{leaveOrDelete}</Text>
          </Pressable>
        </View>
        {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}
      </ScrollView>

      <PromptModal
        visible={renaming}
        title="Rename project"
        initialValue={project.name}
        onCancel={() => setRenaming(false)}
        onSave={(name) => {
          renameProject(id, name);
          setRenaming(false);
        }}
      />
      <ActionSheet
        visible={confirmRemove}
        title={project.isOwner ? `Delete "${project.name}"?` : `Leave "${project.name}"?`}
        message={
          project.isOwner
            ? project.isCloud
              ? "Deletes it for everyone it's shared with, including all transcriptions, clips and equipment. This can't be undone."
              : "Deletes all its transcriptions, clips and equipment. This can't be undone."
            : "You'll lose access. Someone on the project can share it with you again."
        }
        onClose={() => setConfirmRemove(false)}
        actions={[
          {
            label: leaveOrDelete,
            destructive: true,
            onPress: async () => {
              setConfirmRemove(false);
              try {
                await removeProject(id);
                router.dismissTo("/");
              } catch (e) {
                setError(e instanceof GroupAccessError || e instanceof Error ? e.message : "Couldn't do that right now.");
              }
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  section: { marginTop: space.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  rowCard: { flexDirection: "row", alignItems: "center" },
  primary: { height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemLast: { borderBottomWidth: 0 },
  pressed: { backgroundColor: colors.surfaceRaised },
});
