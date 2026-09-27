import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { useAuth } from "@/lib/auth";
import { useClips } from "@/lib/clips-store";
import { useProjects, type ProjectInfo } from "@/lib/projects-store";
import { defaultProjectName, friendlyDate } from "@/lib/projects";
import { joinWithCode } from "@/lib/sharing";
import { useSync, useSyncStatus } from "@/lib/sync/SyncProvider";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Dialog =
  | { kind: "new" }
  | { kind: "join" }
  | { kind: "menu"; project: ProjectInfo }
  | { kind: "rename"; project: ProjectInfo }
  | { kind: "confirmDelete"; project: ProjectInfo }
  | null;

/** "today", "yesterday", "Sep 12" */
const openedLabel = (ms: number) => {
  const d = friendlyDate(ms);
  return d === "Today" || d === "Yesterday" ? d.toLowerCase() : d;
};

/** First screen: start, join, open, share, rename, delete or leave projects. */
export default function Projects() {
  const { projects, loaded, addProject, renameProject, removeProject, touchProject } = useProjects();
  const { clips } = useClips();
  const { me } = useAuth();
  const { engine } = useSync();
  const status = useSyncStatus();
  const params = useLocalSearchParams<{ join?: string }>();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (params.join) {
      setDialog({ kind: "join" });
      router.setParams({ join: undefined });
    }
  }, [params.join]);

  const open = (p: { id: string }) => {
    touchProject(p.id);
    router.push({ pathname: "/project/[id]", params: { id: p.id } });
  };
  const share = (p: { id: string }) => router.push({ pathname: "/project/[id]/settings", params: { id: p.id } });

  const join = async (code: string) => {
    setDialog(null);
    if (!code.trim()) return;
    setJoining(true);
    setNotice(null);
    try {
      const pid = await joinWithCode(code);
      await engine.sync();
      if (engine.get("projects", pid)) open({ id: pid });
      else setNotice("Joined. The project will appear as soon as it finishes downloading.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't join with that code.");
    } finally {
      setJoining(false);
    }
  };

  const clipCount = (id: string) => clips.filter((c) => c.projectId === id).length;
  const initial = me ? (me.name ?? me.email).slice(0, 1).toUpperCase() : null;

  const statusLine = !me
    ? null
    : status.syncing
      ? "Syncing…"
      : status.error
        ? status.pending
          ? `Offline · ${status.pending} change${status.pending === 1 ? "" : "s"} waiting`
          : "Offline"
        : "Synced";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>ON SET</Text>
          {statusLine ? (
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: status.error ? colors.markOut : colors.markIn }]} />
              <Text style={type.small}>{statusLine}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push("/account")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={me ? "Account" : "Sign in"}
          style={({ pressed }) => [me ? styles.avatar : styles.signIn, pressed && { opacity: 0.7 }]}
        >
          {me ? <Text style={styles.avatarText}>{initial}</Text> : <Text style={[type.label, { color: colors.text }]}>Sign in</Text>}
        </Pressable>
      </View>

      <Pressable
        onPress={() => setDialog({ kind: "new" })}
        style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={styles.plus}>+</Text>
        <Text style={[type.button, { color: colors.bg }]}>New project</Text>
      </Pressable>
      <Pressable
        onPress={() => (me ? setDialog({ kind: "join" }) : router.push("/account"))}
        style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        {joining ? <ActivityIndicator color={colors.text} /> : <Text style={[type.label, { color: colors.text }]}>Join a project with a code</Text>}
      </Pressable>
      {notice ? <Text style={[type.small, { color: colors.markOut, textAlign: "center" }]}>{notice}</Text> : null}

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
              accessibilityHint="Opens the project. Press and hold to share, rename or delete."
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.heading} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={type.small}>
                  {n === 1 ? "1 clip" : `${n} clips`} · Opened {openedLabel(item.updatedAt)}
                </Text>
                {!item.isOwner ? <Text style={[type.small, { color: colors.markIn }]}>Shared with you</Text> : null}
              </View>
              <Text style={[type.heading, { color: colors.faint }]}>›</Text>
            </Pressable>
          );
        }}
      />
      {projects.length ? <Text style={[type.small, styles.hint]}>Press and hold a project to share, rename or delete</Text> : null}

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

      <PromptModal
        visible={dialog?.kind === "join"}
        title="Join a project"
        message="Enter the invite code someone shared with you."
        placeholder="ABCD-EFGH"
        saveLabel="Join"
        onCancel={() => setDialog(null)}
        onSave={join}
      />

      <ActionSheet
        visible={dialog?.kind === "menu"}
        title={dialog?.kind === "menu" ? dialog.project.name : undefined}
        message={dialog?.kind === "menu" && !dialog.project.isOwner ? "Shared with you" : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "menu"
            ? [
                {
                  label: "Share",
                  onPress: () => {
                    setDialog(null);
                    share(dialog.project);
                  },
                },
                { label: "Rename", onPress: () => setDialog({ kind: "rename", project: dialog.project }) },
                {
                  label: dialog.project.isOwner ? "Delete" : "Leave project",
                  destructive: true,
                  onPress: () => setDialog({ kind: "confirmDelete", project: dialog.project }),
                },
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
        title={
          dialog?.kind === "confirmDelete"
            ? dialog.project.isOwner
              ? `Delete "${dialog.project.name}"?`
              : `Leave "${dialog.project.name}"?`
            : undefined
        }
        message={
          dialog?.kind === "confirmDelete"
            ? dialog.project.isOwner
              ? dialog.project.isCloud
                ? "Deletes it for everyone it's shared with, including all transcriptions, clips and equipment. This can't be undone."
                : "Deletes all its transcriptions, clips and equipment. This can't be undone."
              : "You'll lose access. Someone on the project can share it with you again."
            : undefined
        }
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmDelete"
            ? [
                {
                  label: dialog.project.isOwner ? "Delete project" : "Leave project",
                  destructive: true,
                  onPress: async () => {
                    const p = dialog.project;
                    setDialog(null);
                    try {
                      await removeProject(p.id);
                    } catch (e) {
                      setNotice(e instanceof Error ? e.message : "Couldn't do that right now.");
                    }
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
  header: { flexDirection: "row", alignItems: "flex-start", paddingTop: space.xl, paddingBottom: space.xl, gap: space.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.xs + 2, marginTop: space.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  signIn: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  newBtn: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  joinBtn: { height: 44, alignItems: "center", justifyContent: "center", marginTop: space.xs },
  plus: { fontSize: 22, lineHeight: 24, color: colors.bg, fontWeight: "600" },
  section: { marginTop: space.lg, marginBottom: space.md },
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
