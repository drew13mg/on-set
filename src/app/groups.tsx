import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GroupEditor } from "@/components/GroupEditor";
import { useAuth } from "@/lib/auth";
import { myGroups, type UserGroup } from "@/lib/sharing";
import { useSync } from "@/lib/sync/SyncProvider";
import { colors, radius, space, type } from "@/lib/theme";

/** Saved user groups (e.g. "Camera dept") to share projects with in one tap. Hold a group to edit it. */
export default function Groups() {
  const { me } = useAuth();
  const { sharingVersion } = useSync();
  const [groups, setGroups] = useState<UserGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ group?: UserGroup } | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups(await myGroups());
      setError(null);
    } catch {
      setError("Can't load groups right now. Check your connection.");
    }
  }, []);

  useEffect(() => {
    if (me) load();
  }, [me, load, sharingVersion]);

  if (!me) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text style={type.body}>Sign in to save user groups.</Text>
          <Pressable onPress={() => router.push("/account")} style={styles.primary}>
            <Text style={[type.button, { color: colors.bg }]}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={groups ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <Pressable onPress={() => setEditor({})} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
              <Text style={[type.button, { color: colors.bg }]}>+ New group</Text>
            </Pressable>
            {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          groups === null ? (
            <ActivityIndicator color={colors.muted} />
          ) : (
            <Text style={[type.body, styles.empty]}>
              Save the people you work with as groups, like "Camera dept" or "Media team". Then share a project with a whole group in
              one tap.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditor({ group: item })}
            onLongPress={() => setEditor({ group: item })}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceRaised }]}
          >
            <View style={styles.cardTop}>
              <Text style={type.heading}>{item.name}</Text>
              <Text style={type.small}>{item.members.length === 1 ? "1 person" : `${item.members.length} people`}</Text>
            </View>
            {item.members.length ? (
              <Text style={type.small} numberOfLines={2}>
                {item.members.join(", ")}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
      {groups?.length ? <Text style={[type.small, styles.hint]}>Tap or hold a group to edit it</Text> : null}
      <GroupEditor
        visible={editor !== null}
        group={editor?.group}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          load();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  newBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.muted, textAlign: "center", marginTop: space.lg, paddingHorizontal: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.xs,
    margin: 0,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  primary: { height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  hint: { textAlign: "center", color: colors.faint, paddingVertical: space.sm },
});
