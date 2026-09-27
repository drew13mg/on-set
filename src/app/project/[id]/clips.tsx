import { useMemo, useState } from "react";
import { Pressable, SectionList, Share, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionSheet } from "@/components/ActionSheet";
import { NameClipModal } from "@/components/NameClipModal";
import { useProjectClips } from "@/lib/clips-store";
import { useCurrentProject } from "@/lib/projects-store";
import { clipsToText, formatDuration, formatTimeOfDay, type Clip } from "@/lib/clips";
import { emailText } from "@/lib/email";
import { exportSubject, exportText, type Transcription } from "@/lib/transcriptions";
import { useProjectTranscriptions } from "@/lib/transcriptions-store";
import { colors, radius, space, type } from "@/lib/theme";

export default function Clips() {
  const { id: projectId, project } = useCurrentProject();
  const { t: onlyTid } = useLocalSearchParams<{ t?: string }>();
  const { clips, renameClip, removeClip } = useProjectClips(projectId);
  const { list: transcriptions } = useProjectTranscriptions(projectId);
  const [editing, setEditing] = useState<Clip | null>(null);
  const [menuFor, setMenuFor] = useState<Clip | null>(null);
  const [deleting, setDeleting] = useState<Clip | null>(null);

  // One section per transcription (named group), newest first; clips sorted by IN time.
  const sections = useMemo(() => {
    const byInTime = (a: Clip, b: Clip) => a.inAt - b.inAt;
    const groups: { key: string; title: string; t?: Transcription; data: Clip[] }[] = transcriptions
      .filter((t) => !onlyTid || t.id === onlyTid)
      .map((t) => ({ key: t.id, title: t.name, t, data: clips.filter((c) => c.transcriptionId === t.id).sort(byInTime) }))
      .filter((g) => g.data.length > 0 || g.key === onlyTid);
    const known = new Set(transcriptions.map((t) => t.id));
    const loose = clips.filter((c) => !c.transcriptionId || !known.has(c.transcriptionId)).sort(byInTime);
    if (loose.length && !onlyTid) groups.push({ key: "other", title: "Other clips", data: loose });
    return groups;
  }, [clips, transcriptions, onlyTid]);

  const projectName = project?.name ?? "ON SET";
  const emailGroup = (g: { title: string; t?: Transcription; data: Clip[] }) => {
    if (g.t) emailText(exportSubject(projectName, g.t), exportText(projectName, g.t, clips));
    else emailText(`${projectName} – ${g.title}`, `${projectName}\n\n${clipsToText(g.data)}`);
  };
  const shareAll = () => {
    const text = sections.map((g) => `${g.title.toUpperCase()}\n\n${clipsToText(g.data)}`).join("\n\n");
    Share.share({ message: `${projectName}\n\n${text}` }).catch(() => {});
  };
  const shown = sections.reduce((n, g) => n + g.data.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: onlyTid ? sections[0]?.title ?? "Clips" : "Clips",
          headerRight: () =>
            shown && !onlyTid ? (
              <Pressable onPress={shareAll} hitSlop={8} style={{ paddingHorizontal: space.sm }}>
                <Text style={[type.label, { color: colors.text }]}>Share</Text>
              </Pressable>
            ) : null,
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={type.label} numberOfLines={1}>
                {section.title}
              </Text>
              <Text style={type.small}>{section.data.length === 1 ? "1 clip" : `${section.data.length} clips`}</Text>
            </View>
            <Pressable onPress={() => emailGroup(section)} hitSlop={8} style={styles.emailBtn}>
              <Text style={[type.label, { color: colors.text }]}>Email</Text>
            </Pressable>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={[type.small, { color: colors.faint }]}>No clips marked in this transcription yet.</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>
            No clips yet. In a transcription, tap Mark In and Mark Out to capture one.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            onLongPress={() => setMenuFor(item)}
            delayLongPress={350}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceRaised }]}
          >
            <View style={styles.cardTop}>
              <Text style={[type.heading, { flex: 1 }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={type.small}>{formatDuration(item.outAt - item.inAt)}</Text>
            </View>
            <Text style={[type.time, styles.times]}>
              <Text style={{ color: colors.markIn }}>IN </Text>
              {formatTimeOfDay(item.inAt)}
              {"    "}
              <Text style={{ color: colors.markOut }}>OUT </Text>
              {formatTimeOfDay(item.outAt)}
            </Text>
            {item.transcript ? (
              <Text style={[type.small, styles.excerpt]} numberOfLines={3}>
                {item.transcript}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
      {shown ? <Text style={[type.small, styles.hint]}>Tap to rename · Hold for more options</Text> : null}

      <NameClipModal
        visible={editing !== null}
        title="Rename clip"
        inAt={editing?.inAt ?? 0}
        outAt={editing?.outAt ?? 0}
        defaultName={editing?.name ?? ""}
        initialName={editing?.name ?? ""}
        cancelLabel="Cancel"
        onSave={(name) => {
          if (editing) renameClip(editing.id, name);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: "Rename", onPress: () => { setEditing(menuFor); setMenuFor(null); } },
                { label: "Delete", destructive: true, onPress: () => { setDeleting(menuFor); setMenuFor(null); } },
              ]
            : []
        }
      />

      <ActionSheet
        visible={deleting !== null}
        title={deleting ? `Delete "${deleting.name}"?` : undefined}
        message="This can't be undone."
        onClose={() => setDeleting(null)}
        actions={
          deleting
            ? [{ label: "Delete clip", destructive: true, onPress: () => { removeClip(deleting.id); setDeleting(null); } }]
            : []
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  empty: { color: colors.muted, textAlign: "center", marginTop: space.xxl, paddingHorizontal: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  emailBtn: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  cardTop: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  times: { color: colors.text },
  excerpt: { lineHeight: 19 },
  hint: { textAlign: "center", paddingBottom: space.sm, color: colors.faint },
});
