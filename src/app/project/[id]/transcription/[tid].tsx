import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NameClipModal } from "@/components/NameClipModal";
import { PromptModal } from "@/components/PromptModal";
import { ProjectHeaderRight } from "@/components/SettingsButton";
import { useProjectClips } from "@/lib/clips-store";
import { useCurrentProject } from "@/lib/projects-store";
import { createClip, defaultClipName, formatDuration, formatTimeOfDay } from "@/lib/clips";
import { useNow } from "@/lib/useNow";
import { useTranscriber } from "@/lib/useTranscriber";
import { useTranscriptions } from "@/lib/transcriptions-store";
import { exportSubject, exportText } from "@/lib/transcriptions";
import { emailText } from "@/lib/email";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

export default function Transcribe() {
  const now = useNow();
  const { tid } = useLocalSearchParams<{ tid: string }>();
  const { id: projectId, project } = useCurrentProject();
  const { clips: projectClips, addClip } = useProjectClips(projectId);
  const { all, appendLines, rename } = useTranscriptions();
  const transcription = all.find((x) => x.id === tid);
  const t = useTranscriber();
  const [renaming, setRenaming] = useState(false);

  // Everything transcribed in this group, across every recording session.
  const lines = transcription?.lines ?? [];
  const clips = projectClips.filter((c) => c.transcriptionId === tid);

  // Transcript lines with saved clips' IN / OUT marks placed where they happened.
  type Row = { key: string; at: number; kind: "line" | "in" | "out"; text: string };
  const rows: Row[] = [
    ...lines.map((l) => ({ key: l.id, at: l.at, kind: "line" as const, text: l.text })),
    ...clips.flatMap((c) => [
      { key: `${c.id}-in`, at: c.inAt, kind: "in" as const, text: c.name },
      { key: `${c.id}-out`, at: c.outAt, kind: "out" as const, text: c.name },
    ]),
  ].sort((a, b) => a.at - b.at || (a.kind === "line" ? 1 : 0) - (b.kind === "line" ? 1 : 0));

  // Save each finished line into the transcription as it arrives.
  const saved = useRef(0);
  useEffect(() => {
    if (!tid) return;
    if (t.lines.length < saved.current) saved.current = 0;
    const fresh = t.lines.slice(saved.current);
    if (fresh.length) {
      appendLines(String(tid), fresh);
      saved.current = t.lines.length;
    }
  }, [t.lines, tid, appendLines]);

  const email = () => {
    if (!transcription) return;
    const name = project?.name ?? "ON SET";
    emailText(exportSubject(name, transcription), exportText(name, transcription, projectClips));
  };

  const [inAt, setInAt] = useState<number | null>(null);
  const [outAt, setOutAt] = useState<number | null>(null);
  const naming = inAt !== null && outAt !== null;

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [lines.length, t.interim]);

  // Timestamps are taken the instant the button is pressed (time of day on the device clock).
  const markIn = () => {
    setInAt(Date.now());
    setOutAt(null);
    tap();
  };
  const markOut = () => {
    if (inAt === null) return;
    setOutAt(Date.now());
    tap();
  };

  const resetMarks = () => {
    setInAt(null);
    setOutAt(null);
  };

  const saveClip = (name: string) => {
    if (inAt === null || outAt === null) return;
    addClip(createClip({ projectId, transcriptionId: String(tid), name, inAt, outAt, lines, existing: clips }));
    resetMarks();
  };

  const canMarkIn = t.isLive && !naming;
  const canMarkOut = inAt !== null && !naming;

  if (!transcription) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={[type.body, { color: colors.muted, marginTop: space.xl }]}>This transcription no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: transcription.name,
          headerRight: () => (
            <ProjectHeaderRight projectId={projectId}>
              <Pressable onPress={() => setRenaming(true)} hitSlop={8}>
                <Text style={[type.label, { color: colors.muted }]}>Rename</Text>
              </Pressable>
              <Pressable onPress={email} hitSlop={8}>
                <Text style={[type.label, { color: colors.text }]}>Email</Text>
              </Pressable>
            </ProjectHeaderRight>
          ),
        }}
      />
      {/* Clock + status */}
      <View style={styles.top}>
        <Text style={type.timeLarge}>{formatTimeOfDay(now)}</Text>
        <View style={[styles.pill, t.isLive && styles.pillLive]}>
          <View style={[styles.dot, t.isLive && styles.dotLive]} />
          <Text style={[type.label, t.isLive && { color: colors.text }]}>
            {t.status === "starting" ? "Starting" : t.isLive ? "Live" : "Ready"}
          </Text>
        </View>
      </View>

      {/* Open mark */}
      <View style={styles.markBar}>
        {inAt !== null ? (
          <Text style={type.time}>
            <Text style={{ color: colors.markIn, fontFamily: fonts.bold }}>IN </Text>
            {formatTimeOfDay(inAt)}
            <Text style={{ color: colors.muted }}>
              {"   "}
              {formatDuration((outAt ?? now) - inAt)}
            </Text>
          </Text>
        ) : (
          <Text style={type.small}>
            {t.isLive ? "Tap Mark In to start a clip." : "Start transcribing to mark clips."}
          </Text>
        )}
      </View>

      {/* Transcript */}
      <View style={styles.transcriptBox}>
        <View style={styles.transcriptHeader}>
          <Text style={type.label}>Transcript</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/project/[id]/clips", params: { id: projectId, t: String(tid) } })}
            hitSlop={8}
          >
            <Text style={[type.label, { color: colors.text }]}>
              {clips.length === 1 ? "1 clip ›" : `${clips.length} clips ›`}
            </Text>
          </Pressable>
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.transcriptContent}>
          {lines.length === 0 && !t.interim ? (
            <Text style={[type.body, { color: colors.faint }]}>
              {t.isLive ? "Listening…" : "Words will appear here as they're spoken."}
            </Text>
          ) : null}
          {rows.map((r) =>
            r.kind === "line" ? (
              <View key={r.key} style={styles.line}>
                <Text style={[type.small, styles.lineTime]}>{formatTimeOfDay(r.at)}</Text>
                <Text
                  style={[
                    type.body,
                    styles.lineText,
                    inAt !== null && r.at >= inAt && (outAt === null || r.at <= outAt) && styles.lineInClip,
                  ]}
                >
                  {r.text}
                </Text>
              </View>
            ) : (
              <View key={r.key} style={styles.markerRow}>
                <Text style={[type.small, styles.lineTime]}>{formatTimeOfDay(r.at)}</Text>
                <Text style={[styles.marker, { color: r.kind === "in" ? colors.markIn : colors.markOut }]}>
                  {r.kind === "in" ? "IN" : "OUT"} · {r.text}
                </Text>
              </View>
            ),
          )}
          {t.interim ? (
            <View style={styles.line}>
              <Text style={[type.small, styles.lineTime]}>{formatTimeOfDay(now)}</Text>
              <Text style={[type.body, styles.lineText, { color: colors.muted }]}>{t.interim}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {t.error ? <Text style={[type.small, styles.error]}>{t.error}</Text> : null}

      {/* Controls */}
      <View style={styles.markRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark In"
          disabled={!canMarkIn}
          onPress={markIn}
          style={({ pressed }) => [
            styles.markBtn,
            { borderColor: colors.markIn },
            pressed && { backgroundColor: colors.markIn },
            !canMarkIn && styles.disabled,
          ]}
        >
          {({ pressed }) => (
            <Text style={[type.button, { color: pressed ? colors.bg : colors.markIn }]}>Mark In</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark Out"
          disabled={!canMarkOut}
          onPress={markOut}
          style={({ pressed }) => [
            styles.markBtn,
            { borderColor: colors.markOut },
            pressed && { backgroundColor: colors.markOut },
            !canMarkOut && styles.disabled,
          ]}
        >
          {({ pressed }) => (
            <Text style={[type.button, { color: pressed ? colors.bg : colors.markOut }]}>Mark Out</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={t.isLive ? t.stop : t.start}
        style={({ pressed }) => [styles.recordBtn, t.isLive && styles.recordBtnLive, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.recordIcon, t.isLive && styles.stopIcon]} />
        <Text style={[type.button, { color: colors.text }]}>
          {t.isLive ? "Stop transcribing" : "Start transcribing"}
        </Text>
      </Pressable>

      <NameClipModal
        visible={naming}
        title="Name this clip"
        inAt={inAt ?? 0}
        outAt={outAt ?? 0}
        defaultName={defaultClipName(clips)}
        onSave={saveClip}
        onCancel={resetMarks}
      />

      <PromptModal
        visible={renaming}
        title="Rename transcription"
        initialValue={transcription.name}
        onCancel={() => setRenaming(false)}
        onSave={(name) => {
          rename(transcription.id, name);
          setRenaming(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, paddingBottom: space.md },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pillLive: { backgroundColor: "rgba(239, 68, 68, 0.18)" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.faint },
  dotLive: { backgroundColor: colors.record },
  markBar: { minHeight: 36, justifyContent: "center", marginTop: space.md },
  transcriptBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: space.sm,
    overflow: "hidden",
  },
  transcriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  transcriptContent: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  line: { flexDirection: "row", gap: space.md },
  lineTime: { width: 64, paddingTop: 3, fontVariant: ["tabular-nums"], color: colors.faint },
  lineText: { flex: 1 },
  lineInClip: { color: colors.markIn },
  markerRow: { flexDirection: "row", gap: space.md, alignItems: "center" },
  marker: { flex: 1, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  headerBtns: { flexDirection: "row", gap: space.lg, paddingHorizontal: space.sm },
  error: { color: colors.record, marginTop: space.sm },
  markRow: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  markBtn: {
    flex: 1,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.3 },
  recordBtn: {
    marginTop: space.md,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  recordBtnLive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.record },
  recordIcon: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.record },
  stopIcon: { borderRadius: 3 },
});
