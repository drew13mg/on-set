import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NameClipModal } from "@/components/NameClipModal";
import { useClips } from "@/lib/clips-store";
import { createClip, defaultClipName, formatDuration, formatTimeOfDay } from "@/lib/clips";
import { useNow } from "@/lib/useNow";
import { useTranscriber } from "@/lib/useTranscriber";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

export default function Transcribe() {
  const now = useNow();
  const { clips, addClip } = useClips();
  const t = useTranscriber();

  const [inAt, setInAt] = useState<number | null>(null);
  const [outAt, setOutAt] = useState<number | null>(null);
  const naming = inAt !== null && outAt !== null;

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [t.lines.length, t.interim]);

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
    addClip(createClip({ name, inAt, outAt, lines: t.lines, existing: clips }));
    resetMarks();
  };

  const canMarkIn = t.isLive && !naming;
  const canMarkOut = inAt !== null && !naming;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
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
          {t.lines.length > 0 && !t.isLive ? (
            <Pressable onPress={t.clear} hitSlop={8}>
              <Text style={[type.label, { color: colors.text }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.transcriptContent}>
          {t.lines.length === 0 && !t.interim ? (
            <Text style={[type.body, { color: colors.faint }]}>
              {t.isLive ? "Listening…" : "Words will appear here as they're spoken."}
            </Text>
          ) : null}
          {t.lines.map((l) => {
            const inClip = inAt !== null && l.at >= inAt && (outAt === null || l.at <= outAt);
            return (
              <View key={l.id} style={styles.line}>
                <Text style={[type.small, styles.lineTime]}>{formatTimeOfDay(l.at)}</Text>
                <Text style={[type.body, styles.lineText, inClip && styles.lineInClip]}>{l.text}</Text>
              </View>
            );
          })}
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
