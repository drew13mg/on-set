import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { GroupEditor } from "@/components/GroupEditor";
import { useSync } from "@/lib/sync/SyncProvider";
import {
  addPeople,
  formatCode,
  inviteCode,
  linkGroup,
  listLinkedGroups,
  listPeople,
  myGroups,
  parseEmails,
  removePerson,
  unlinkGroup,
  type LinkedGroup,
  type Person,
  type UserGroup,
} from "@/lib/sharing";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Props = { projectId: string; projectName: string; isOwner: boolean };

/** Share a project with people or saved user groups, any time (not just the first time). */
export function SharePanel({ projectId, projectName, isOwner }: Props) {
  const { sharingVersion, engine } = useSync();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [linked, setLinked] = useState<LinkedGroup[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [emails, setEmails] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ group?: UserGroup; linkAfter: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, l, g] = await Promise.all([listPeople(projectId), listLinkedGroups(projectId), myGroups()]);
      setPeople(p);
      setLinked(l);
      setGroups(g);
      setError(null);
    } catch (e) {
      setError("Can't load sharing right now. Check your connection.");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, sharingVersion]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
      engine.sync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const add = () => {
    const { valid, invalid } = parseEmails(emails);
    const warning = invalid.length ? `Not an email: ${invalid.join(", ")}` : null;
    if (!valid.length) return setError(warning);
    run("add", async () => {
      await addPeople(projectId, valid);
      setEmails(invalid.join(" "));
    }).then(() => warning && setError(warning));
  };

  const linkedIds = new Set(linked.map((g) => g.id));
  const toggleGroup = (g: UserGroup) =>
    run(`group-${g.id}`, () => (linkedIds.has(g.id) ? unlinkGroup(projectId, g.id) : linkGroup(projectId, g.id)));

  const sendCode = async () => {
    let c = code;
    if (!c) {
      setBusy("code");
      try {
        c = await inviteCode(projectId);
        setCode(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't make a code.");
        return;
      } finally {
        setBusy(null);
      }
    }
    Share.share({
      message: `Join "${projectName}" on ON SET.\n\nOpen ON SET, tap "Join a project" and enter this code: ${formatCode(c)}`,
    }).catch(() => {});
  };

  const othersGroups = linked.filter((g) => !g.isMine);

  return (
    <View style={{ gap: space.md }}>
      {/* Add people */}
      <Text style={type.label}>Add people</Text>
      <View style={styles.row}>
        <TextInput
          value={emails}
          onChangeText={setEmails}
          placeholder="Emails, separated by commas"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={add}
          style={styles.input}
          accessibilityLabel="Share with emails"
        />
        <Pressable onPress={add} disabled={!!busy} style={styles.primarySmall}>
          {busy === "add" ? <ActivityIndicator color={colors.bg} /> : <Text style={[type.button, { color: colors.bg }]}>Share</Text>}
        </Pressable>
      </View>

      {/* Saved user groups */}
      <View style={styles.sectionHead}>
        <Text style={type.label}>Your user groups</Text>
        {groups.length ? <Text style={type.small}>Tap to share · hold to edit</Text> : null}
      </View>
      <View style={styles.chips}>
        {groups.map((g) => {
          const on = linkedIds.has(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => toggleGroup(g)}
              onLongPress={() => setEditor({ group: g, linkAfter: false })}
              delayLongPress={350}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              {busy === `group-${g.id}` ? (
                <ActivityIndicator size="small" color={on ? colors.bg : colors.text} />
              ) : (
                <Text style={[styles.chipText, on && { color: colors.bg }]}>
                  {on ? "✓ " : "+ "}
                  {g.name}
                  <Text style={{ color: on ? colors.bg : colors.muted }}>  {g.members.length}</Text>
                </Text>
              )}
            </Pressable>
          );
        })}
        <Pressable onPress={() => setEditor({ linkAfter: true })} style={[styles.chip, styles.chipDashed]}>
          <Text style={[styles.chipText, { color: colors.muted }]}>+ New group</Text>
        </Pressable>
      </View>
      {othersGroups.length ? (
        <Text style={type.small}>Also shared with: {othersGroups.map((g) => `${g.name} (${g.memberCount})`).join(", ")}</Text>
      ) : null}

      {/* Invite code */}
      <View style={styles.codeCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.label}>Invite code</Text>
          <Text style={code ? styles.code : type.small}>
            {code ? formatCode(code) : "Anyone with the code can join. Handy for people who sign in with Apple's Hide My Email."}
          </Text>
        </View>
        <Pressable onPress={sendCode} disabled={busy === "code"} style={styles.secondarySmall}>
          {busy === "code" ? <ActivityIndicator color={colors.text} /> : <Text style={[type.button, { color: colors.text }]}>{code ? "Send" : "Get code"}</Text>}
        </Pressable>
      </View>

      {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}

      {/* Who has access */}
      <Text style={[type.label, { marginTop: space.sm }]}>
        {people ? `People with access · ${people.length}` : "People with access"}
      </Text>
      {!people ? (
        <ActivityIndicator color={colors.muted} style={{ alignSelf: "flex-start" }} />
      ) : (
        <View style={styles.people}>
          {people.map((p) => (
            <View key={p.email} style={styles.person}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(p.name ?? p.email).slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.body} numberOfLines={1}>
                  {p.name ?? p.email}
                  {p.isMe ? <Text style={{ color: colors.muted }}>  (you)</Text> : null}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {p.name ? `${p.email} · ` : ""}
                  {p.isOwner ? "Owner" : p.via === "group" ? `via ${p.groupName}` : "Added"}
                </Text>
              </View>
              {isOwner && p.via === "direct" && !p.isMe ? (
                <Pressable
                  onPress={() => run(`rm-${p.email}`, () => removePerson(projectId, p.email))}
                  hitSlop={10}
                  accessibilityLabel={`Remove ${p.email}`}
                >
                  {busy === `rm-${p.email}` ? <ActivityIndicator color={colors.muted} /> : <Text style={[type.heading, { color: colors.muted }]}>×</Text>}
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <GroupEditor
        visible={editor !== null}
        group={editor?.group}
        onClose={() => setEditor(null)}
        onSaved={async (id) => {
          const linkAfter = editor?.linkAfter;
          setEditor(null);
          if (id && linkAfter) await run(`group-${id}`, () => linkGroup(projectId, id));
          else await load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  input: {
    flex: 1,
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
  primarySmall: {
    paddingHorizontal: space.lg,
    minWidth: 84,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  secondarySmall: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minWidth: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
  },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 38,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDashed: { borderStyle: "dashed", backgroundColor: "transparent" },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.sm,
  },
  code: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: 3, color: colors.text },
  people: { gap: space.xs },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
