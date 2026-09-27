import { useState } from "react";
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { NameClipModal } from "@/components/NameClipModal";
import { useClips } from "@/lib/clips-store";
import { clipsToText, formatDuration, formatTimeOfDay, type Clip } from "@/lib/clips";
import { colors, radius, space, type } from "@/lib/theme";

export default function Clips() {
  const { clips, renameClip, removeClip } = useClips();
  const [editing, setEditing] = useState<Clip | null>(null);

  const shareAll = () => {
    if (clips.length) Share.share({ message: clipsToText(clips) }).catch(() => {});
  };

  const confirmDelete = (clip: Clip) =>
    Alert.alert(`Delete "${clip.name}"?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeClip(clip.id) },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerRight: () =>
            clips.length ? (
              <Pressable onPress={shareAll} hitSlop={8} style={{ paddingHorizontal: space.sm }}>
                <Text style={[type.label, { color: colors.text }]}>Share</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={clips}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>
            No clips yet. In Transcribe, tap Mark In and Mark Out to capture one.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            onLongPress={() => confirmDelete(item)}
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
      {clips.length ? <Text style={[type.small, styles.hint]}>Tap to rename · Hold to delete</Text> : null}

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
  cardTop: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  times: { color: colors.text },
  excerpt: { lineHeight: 19 },
  hint: { textAlign: "center", paddingBottom: space.sm, color: colors.faint },
});
