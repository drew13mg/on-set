import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ActionSheet } from "@/components/ActionSheet";
import { PromptModal } from "@/components/PromptModal";
import { useCurrentProject } from "@/lib/projects-store";
import { useEquipmentLibrary, useProjectEquipment } from "@/lib/equipment-store";
import {
  addTyped,
  clearChecks,
  detachLibraryItem,
  displayName,
  filterLibrary,
  isSelected,
  oneOffs,
  progress,
  removeLibraryItem,
  removeListItem,
  renameLibraryItem,
  renameListItem,
  saveList,
  toggleHave,
  toggleLibraryItem,
  type LibraryItem,
  type ListItem,
} from "@/lib/equipment";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const GREEN = colors.markIn;
const tick = () => Haptics.selectionAsync().catch(() => {});

type Menu =
  | { kind: "library"; item: LibraryItem }
  | { kind: "oneOff"; item: ListItem }
  | { kind: "check"; item: ListItem }
  | { kind: "clearChecks" }
  | null;
type Rename = { kind: "library"; item: LibraryItem } | { kind: "list"; item: ListItem } | null;

export default function Equipment() {
  const { id: projectId } = useCurrentProject();
  const { library, setLibrary } = useEquipmentLibrary();
  const { list, loaded, setList } = useProjectEquipment(projectId);

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  const [rename, setRename] = useState<Rename>(null);

  const mode: "build" | "check" = list.savedAt !== null && !editing ? "check" : "build";
  const chips = useMemo(() => filterLibrary(library, text), [library, text]);
  const extras = oneOffs(list);
  const { have, total } = progress(list);
  const typedMatches = text.trim() && library.some((l) => l.name.toLowerCase() === text.trim().toLowerCase());

  const add = () => {
    if (!text.trim()) return;
    const r = addTyped(list, library, text, saveToLibrary);
    setLibrary(() => r.lib);
    setList(() => r.list);
    setText("");
    tick();
  };

  const save = () => {
    setList((l) => saveList(l));
    setEditing(false);
    setText("");
  };

  const nameOf = (i: ListItem) => displayName(i, library);

  if (!loaded) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: mode === "check" ? "Equipment" : "Build list",
          headerRight: () =>
            mode === "check" ? (
              <Pressable onPress={() => setEditing(true)} hitSlop={8} style={{ paddingHorizontal: space.sm }}>
                <Text style={[type.label, { color: colors.text }]}>Edit list</Text>
              </Pressable>
            ) : null,
        }}
      />

      {mode === "build" ? (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Manual entry */}
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Add equipment, e.g. Sony FX6"
                placeholderTextColor={colors.faint}
                returnKeyType="done"
                onSubmitEditing={add}
                blurOnSubmit={false}
                style={styles.input}
                accessibilityLabel="Equipment name"
              />
              <Pressable
                onPress={add}
                disabled={!text.trim()}
                style={({ pressed }) => [styles.addBtn, !text.trim() && styles.btnOff, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
              >
                <Text style={[type.button, { color: text.trim() ? colors.bg : colors.faint }]}>Add</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setSaveToLibrary((v) => !v)} style={styles.toggleRow} accessibilityRole="checkbox" accessibilityState={{ checked: saveToLibrary }}>
              <View style={[styles.box, saveToLibrary && styles.boxOn]}>
                {saveToLibrary ? <Text style={styles.boxTick}>✓</Text> : null}
              </View>
              <Text style={type.small}>Save to My equipment for future projects</Text>
            </Pressable>

            {/* Saved equipment chips */}
            <View style={styles.sectionHead}>
              <Text style={type.label}>My equipment</Text>
              <Text style={type.small}>{library.length ? "Tap to add · hold to edit" : ""}</Text>
            </View>
            {library.length === 0 ? (
              <Text style={[type.small, styles.empty]}>
                Equipment you save appears here as buttons, ready to pick in any project.
              </Text>
            ) : chips.length === 0 ? (
              <Text style={[type.small, styles.empty]}>
                Nothing saved matches "{text.trim()}". Tap Add to add it.
              </Text>
            ) : (
              <View style={styles.chips}>
                {chips.map((c) => {
                  const on = isSelected(list, c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setList((l) => toggleLibraryItem(l, c));
                        tick();
                      }}
                      onLongPress={() => setMenu({ kind: "library", item: c })}
                      delayLongPress={350}
                      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && { color: colors.bg }]}>
                        {on ? "✓ " : "+ "}
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {text.trim() && !typedMatches && chips.length > 0 ? (
              <Text style={[type.small, styles.empty]}>Tap Add to add "{text.trim()}".</Text>
            ) : null}

            {/* One-offs for this project */}
            {extras.length ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={type.label}>This project only</Text>
                </View>
                <View style={styles.chips}>
                  {extras.map((i) => (
                    <Pressable
                      key={i.id}
                      onPress={() => setList((l) => removeListItem(l, i.id))}
                      onLongPress={() => setMenu({ kind: "oneOff", item: i })}
                      delayLongPress={350}
                      style={({ pressed }) => [styles.chip, styles.chipOn, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                      accessibilityHint="Tap to remove from this project"
                    >
                      <Text style={[styles.chipText, { color: colors.bg }]}>✓ {i.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={save}
              disabled={total === 0}
              style={({ pressed }) => [styles.saveBtn, total === 0 && styles.btnOff, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={[type.button, { color: total === 0 ? colors.faint : colors.bg }]}>
                {total === 0 ? "Save list" : `Save list · ${total} item${total === 1 ? "" : "s"}`}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Checklist / reference page */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTop}>
              <Text style={type.heading}>
                {have === total && total > 0 ? "All equipment checked" : `${have} of ${total} checked`}
              </Text>
              <Text style={type.small}>Tap to check · hold to edit</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${total ? (have / total) * 100 : 0}%` }]} />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.checkList}>
            {list.items.map((i) => (
              <Pressable
                key={i.id}
                onPress={() => {
                  setList((l) => toggleHave(l, i.id));
                  tick();
                }}
                onLongPress={() => setMenu({ kind: "check", item: i })}
                delayLongPress={350}
                style={({ pressed }) => [styles.checkBtn, i.have && styles.checkBtnOn, pressed && { opacity: 0.85 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: i.have }}
              >
                <View style={[styles.circle, i.have && styles.circleOn]}>
                  {i.have ? <Text style={styles.circleTick}>✓</Text> : null}
                </View>
                <Text style={[styles.checkText, i.have && { color: colors.bg }]} numberOfLines={2}>
                  {nameOf(i)}
                </Text>
              </Pressable>
            ))}
            {have > 0 ? (
              <Pressable onPress={() => setMenu({ kind: "clearChecks" })} style={styles.clear} hitSlop={8}>
                <Text style={[type.label, { color: colors.muted }]}>Clear all checks</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </>
      )}

      {/* Long-press menus */}
      <ActionSheet
        visible={menu !== null}
        title={
          menu?.kind === "library"
            ? menu.item.name
            : menu?.kind === "oneOff" || menu?.kind === "check"
              ? nameOf(menu.item)
              : menu?.kind === "clearChecks"
                ? "Clear all checks?"
                : undefined
        }
        message={
          menu?.kind === "library"
            ? "Saved equipment, available in every project."
            : menu?.kind === "clearChecks"
              ? "Every item goes back to unchecked."
              : undefined
        }
        onClose={() => setMenu(null)}
        actions={
          menu?.kind === "library"
            ? [
                { label: "Edit", onPress: () => { setRename({ kind: "library", item: menu.item }); setMenu(null); } },
                {
                  label: "Delete from My equipment",
                  destructive: true,
                  onPress: () => {
                    const id = menu.item.id;
                    // Keep it on this project's list if it's selected; it just stops being saved gear.
                    setList((l) => (isSelected(l, id) ? detachLibraryItem(l, library, id) : l));
                    setLibrary((lib) => removeLibraryItem(lib, id));
                    setMenu(null);
                  },
                },
              ]
            : menu?.kind === "oneOff" || menu?.kind === "check"
              ? [
                  { label: "Edit", onPress: () => { setRename({ kind: "list", item: menu.item }); setMenu(null); } },
                  {
                    label: menu.kind === "check" ? "Delete from this list" : "Delete",
                    destructive: true,
                    onPress: () => {
                      setList((l) => removeListItem(l, menu.item.id));
                      setMenu(null);
                    },
                  },
                ]
              : menu?.kind === "clearChecks"
                ? [{ label: "Clear checks", destructive: true, onPress: () => { setList((l) => clearChecks(l)); setMenu(null); } }]
                : []
        }
      />

      <PromptModal
        visible={rename !== null}
        title="Edit equipment"
        message={
          rename?.kind === "library" || (rename?.kind === "list" && rename.item.libraryId && library.some((l) => l.id === rename.item.libraryId))
            ? "Updates it in My equipment, for every project."
            : undefined
        }
        initialValue={rename?.kind === "library" ? rename.item.name : rename?.kind === "list" ? nameOf(rename.item) : ""}
        onCancel={() => setRename(null)}
        onSave={(name) => {
          if (rename?.kind === "library") {
            setLibrary((lib) => renameLibraryItem(lib, rename.item.id, name));
          } else if (rename?.kind === "list") {
            const libId = rename.item.libraryId;
            if (libId && library.some((l) => l.id === libId)) {
              setLibrary((lib) => renameLibraryItem(lib, libId, name));
            }
            setList((l) => renameListItem(l, rename.item.id, name));
          }
          setRename(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  inputRow: { flexDirection: "row", gap: space.sm },
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
  addBtn: { paddingHorizontal: space.xl, borderRadius: radius.md, backgroundColor: colors.accent, justifyContent: "center" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  boxTick: { color: colors.bg, fontSize: 13, lineHeight: 15, fontFamily: fonts.bold },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: space.lg,
  },
  empty: { color: colors.faint },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  footer: {
    padding: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  saveBtn: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: GREEN, borderRadius: 3 },
  checkList: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 58,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkBtnOn: { backgroundColor: GREEN, borderColor: GREEN },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  circleOn: { borderColor: colors.bg, backgroundColor: colors.bg },
  circleTick: { color: GREEN, fontSize: 14, lineHeight: 16, fontFamily: fonts.bold },
  checkText: { flex: 1, fontFamily: fonts.medium, fontSize: 17, color: colors.text },
  clear: { alignSelf: "center", marginTop: space.lg },
  btnOff: { backgroundColor: colors.surfaceRaised },
});
