import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { deleteGroup, parseEmails, saveGroup, type UserGroup } from "@/lib/sharing";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Props = {
  visible: boolean;
  /** Existing group to edit; omit to create a new one. */
  group?: UserGroup;
  onClose: () => void;
  onSaved: (groupId: string | null) => void;
};

/** Create or edit a saved user group: a name plus the people in it (by email). */
export function GroupEditor({ visible, group, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(group?.name ?? "");
    setMembers(group?.members ?? []);
    setAdding("");
    setError(null);
    setConfirmDelete(false);
  }, [visible, group]);

  const add = () => {
    const { valid, invalid } = parseEmails(adding);
    setMembers((m) => [...m, ...valid.filter((e) => !m.includes(e))].sort());
    setAdding(invalid.join(" "));
    setError(invalid.length ? `Not an email: ${invalid.join(", ")}` : null);
  };

  const save = async () => {
    // Include anything still typed in the box.
    const typed = parseEmails(adding).valid;
    const all = [...new Set([...members, ...typed])].sort();
    if (!name.trim()) return setError("Give the group a name.");
    setBusy(true);
    setError(null);
    try {
      const id = await saveGroup({ id: group?.id, name, members: all }, group);
      onSaved(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the group.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteGroup(group.id);
      onSaved(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[type.label, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
            <Text style={type.heading}>{group ? "Edit group" : "New group"}</Text>
            <Pressable onPress={save} disabled={busy} hitSlop={10}>
              {busy ? <ActivityIndicator color={colors.text} /> : <Text style={[type.label, { color: colors.text }]}>Save</Text>}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={type.label}>Group name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Camera dept, Pistons media team"
              placeholderTextColor={colors.faint}
              style={styles.input}
              accessibilityLabel="Group name"
            />

            <Text style={[type.label, { marginTop: space.lg }]}>Add people</Text>
            <View style={styles.row}>
              <TextInput
                value={adding}
                onChangeText={setAdding}
                placeholder="Emails, separated by commas"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onSubmitEditing={add}
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel="Add group member emails"
              />
              <Pressable onPress={add} style={styles.addBtn}>
                <Text style={[type.button, { color: colors.bg }]}>Add</Text>
              </Pressable>
            </View>
            {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}

            <Text style={[type.label, { marginTop: space.lg }]}>
              {members.length === 1 ? "1 person" : `${members.length} people`}
            </Text>
            {members.length === 0 ? (
              <Text style={[type.small, { color: colors.faint }]}>No one yet. Add emails above.</Text>
            ) : (
              <View style={styles.list}>
                {members.map((m) => (
                  <View key={m} style={styles.member}>
                    <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                      {m}
                    </Text>
                    <Pressable
                      onPress={() => setMembers((ms) => ms.filter((x) => x !== m))}
                      hitSlop={10}
                      accessibilityLabel={`Remove ${m}`}
                    >
                      <Text style={[type.heading, { color: colors.muted }]}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <Text style={[type.small, styles.note]}>
              Projects shared with this group stay linked: people you add here get access, and people you remove lose it.
            </Text>

            {group ? (
              <Pressable onPress={remove} disabled={busy} style={[styles.deleteBtn, confirmDelete && { backgroundColor: colors.record }]}>
                <Text style={[type.button, { color: confirmDelete ? colors.text : colors.record }]}>
                  {confirmDelete ? "Tap again to delete group" : "Delete group"}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  content: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  row: { flexDirection: "row", gap: space.sm },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  addBtn: { paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.accent, justifyContent: "center" },
  list: { gap: space.xs },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  note: { color: colors.faint, marginTop: space.lg },
  deleteBtn: {
    marginTop: space.xl,
    alignItems: "center",
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.record,
  },
});
