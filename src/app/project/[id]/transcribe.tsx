import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { useProjectClips } from "@/lib/clips-store";
import { emailText } from "@/lib/email";
import { friendlyDate } from "@/lib/projects";
import { useCurrentProject } from "@/lib/projects-store";
import { formatTimeOfDay } from "@/lib/clips";
import {
  defaultTranscriptionName,
  exportSubject,
  exportText,
  recordedSpan,
  wordCount,
  type Transcription,
} from "@/lib/transcriptions";
import { useProjectTranscriptions } from "@/lib/transcriptions-store";
import { colors, radius, space, type } from "@/lib/theme";

type Dialog =
  | { kind: "new" }
  | { kind: "menu"; t: Transcription }
  | { kind: "rename"; t: Transcription }
  | { kind: "confirmDelete"; t: Transcription }
  | null;

/** A project's transcriptions: each is a named group with its own transcript and clip list. */
export default function Transcriptions() {
  const { id: projectId, project } = useCurrentProject();
  const { list, loaded, add, rename, remove } = useProjectTranscriptions(projectId);
  const { clips } = useProjectClips(projectId);
  const [dialog, setDialog] = useState<Dialog>(null);

  const clipCount = (tid: string) => clips.filter((c) => c.transcriptionId === tid).length;
  const open = (t: Transcription) =>
    router.push({ pathname: "/project/[id]/transcription/[tid]", params: { id: projectId, tid: t.id } });
  const email = (t: Transcription) => {
    const name = project?.name ?? "ON SET";
    emailText(exportSubject(name, t), exportText(name, t, clips));
  };

  const summary = (t: Transcription) => {
    const n = clipCount(t.id);
    const span = recordedSpan(t);
    const parts = [
      friendlyDate(span?.start ?? t.createdAt),
      span ? `${formatTimeOfDay(span.start).slice(0, 5)}–${formatTimeOfDay(span.end).slice(0, 5)}` : "Not started",
      n === 1 ? "1 clip" : `${n} clips`,
    ];
    return parts.join(" · ");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            <Pressable
              onPress={() => setDialog({ kind: "new" })}
              style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={styles.plus}>+</Text>
              <Text style={[type.button, { color: colors.bg }]}>New transcription</Text>
            </Pressable>
            {list.length ? <Text style={type.label}>Saved transcriptions</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <Text style={[type.body, styles.empty]}>
              Each transcription keeps its own transcript and clip list under the name you give it, like "Locker room
              interviews" or "Day 2 – B camera".
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            onLongPress={() => setDialog({ kind: "menu", t: item })}
            delayLongPress={350}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceRaised }]}
            accessibilityRole="button"
            accessibilityHint="Opens the transcription. Press and hold for rename, email or delete."
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.heading} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={type.small}>{summary(item)}</Text>
              {item.lines.length ? (
                <Text style={[type.small, { color: colors.faint }]} numberOfLines={1}>
                  {wordCount(item)} words · "{item.lines[item.lines.length - 1].text}"
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => email(item)} hitSlop={10} style={styles.emailBtn} accessibilityLabel={`Email ${item.name}`}>
              <Text style={[type.label, { color: colors.text }]}>Email</Text>
            </Pressable>
          </Pressable>
        )}
      />
      {list.length ? <Text style={[type.small, styles.hint]}>Press and hold for rename, email or delete</Text> : null}

      <PromptModal
        visible={dialog?.kind === "new"}
        title="New transcription"
        message="Name this group. Its transcript and clips are saved together."
        placeholder={defaultTranscriptionName(list)}
        saveLabel="Start"
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          const t = add(projectId, name);
          setDialog(null);
          open(t);
        }}
      />

      <ActionSheet
        visible={dialog?.kind === "menu"}
        title={dialog?.kind === "menu" ? dialog.t.name : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "menu"
            ? [
                { label: "Rename", onPress: () => setDialog({ kind: "rename", t: dialog.t }) },
                { label: "Email transcript & clips", onPress: () => { email(dialog.t); setDialog(null); } },
                { label: "Delete", destructive: true, onPress: () => setDialog({ kind: "confirmDelete", t: dialog.t }) },
              ]
            : []
        }
      />

      <PromptModal
        visible={dialog?.kind === "rename"}
        title="Rename transcription"
        initialValue={dialog?.kind === "rename" ? dialog.t.name : ""}
        onCancel={() => setDialog(null)}
        onSave={(name) => {
          if (dialog?.kind === "rename") rename(dialog.t.id, name);
          setDialog(null);
        }}
      />

      <ActionSheet
        visible={dialog?.kind === "confirmDelete"}
        title={dialog?.kind === "confirmDelete" ? `Delete "${dialog.t.name}"?` : undefined}
        message={
          dialog?.kind === "confirmDelete"
            ? clipCount(dialog.t.id)
              ? `Deletes the transcript and its ${clipCount(dialog.t.id) === 1 ? "clip" : `${clipCount(dialog.t.id)} clips`}. This can't be undone.`
              : "Deletes the transcript. This can't be undone."
            : undefined
        }
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmDelete"
            ? [{ label: "Delete transcription", destructive: true, onPress: () => { remove(dialog.t.id); setDialog(null); } }]
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
    padding: space.lg,
  },
  emailBtn: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  hint: { textAlign: "center", color: colors.faint, paddingVertical: space.sm },
});
