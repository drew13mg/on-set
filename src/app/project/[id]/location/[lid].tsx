import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ActionSheet } from "@/components/ActionSheet";
import { PhotoImage } from "@/components/PhotoImage";
import { PhotoViewer } from "@/components/PhotoViewer";
import { PromptModal } from "@/components/PromptModal";
import { useCurrentProject } from "@/lib/projects-store";
import { MAX_PHOTOS } from "@/lib/scouting";
import { useLocation, type PickedImage } from "@/lib/scouting-store";
import type { LocationNoteRow, LocationPhotoRow } from "@/lib/sync/model";
import { friendlyDate } from "@/lib/projects";
import { formatTimeOfDay } from "@/lib/clips";
import { colors, radius, space, type } from "@/lib/theme";

const COLS = 3;
const GAP = space.sm;

type Dialog =
  | { kind: "addPhoto" }
  | { kind: "photoMenu"; photo: LocationPhotoRow }
  | { kind: "photoNote"; photo: LocationPhotoRow }
  | { kind: "confirmPhotoDelete"; photo: LocationPhotoRow }
  | { kind: "newNote" }
  | { kind: "noteMenu"; note: LocationNoteRow }
  | { kind: "editNote"; note: LocationNoteRow }
  | { kind: "confirmNoteDelete"; note: LocationNoteRow }
  | null;

/** One scouted location: up to 10 photos (library or camera) and notes. */
export default function LocationScreen() {
  const { id: projectId } = useCurrentProject();
  const { lid } = useLocalSearchParams<{ lid: string }>();
  const { location, photos, notes, slots, addNote, editNote, removeNote, addPhotos, setPhotoNote, removePhoto } = useLocation(projectId, String(lid));
  const { width } = useWindowDimensions();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const tile = Math.floor((Math.min(width, 700) - space.lg * 2 - GAP * (COLS - 1)) / COLS);

  const save = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const picked: PickedImage[] = assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
      const { skipped } = await addPhotos(picked);
      if (skipped) setMessage(`Only ${MAX_PHOTOS} photos per location. ${skipped} ${skipped === 1 ? "photo wasn't" : "photos weren't"} added.`);
    } catch (e) {
      setMessage("Couldn't save that photo. Try again.");
      console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  const fromLibrary = async () => {
    setDialog(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: slots > 1,
      selectionLimit: slots,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) save(res.assets);
  };

  const takePhoto = async () => {
    setDialog(null);
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setMessage("Camera access is off. Turn it on for ON SET in Settings.");
        return;
      }
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
    if (!res.canceled) save(res.assets);
  };

  if (!location) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={[type.body, { color: colors.muted, padding: space.lg }]}>This location no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: location.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Photos */}
        <View style={styles.sectionHead}>
          <Text style={type.heading}>Photos</Text>
          <Text style={type.small}>
            {photos.length} / {MAX_PHOTOS}
          </Text>
        </View>
        <View style={styles.grid}>
          {photos.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => setViewerAt(i)}
              onLongPress={() => setDialog({ kind: "photoMenu", photo: p })}
              delayLongPress={350}
              accessibilityRole="imagebutton"
              accessibilityLabel={p.note ? `Photo ${i + 1}: ${p.note}` : `Photo ${i + 1}`}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            >
              <PhotoImage photo={p} style={{ width: tile, height: tile, borderRadius: radius.md }} showNoteBadge />
            </Pressable>
          ))}
          {slots > 0 ? (
            <Pressable
              onPress={() => setDialog({ kind: "addPhoto" })}
              disabled={busy}
              style={({ pressed }) => [styles.addTile, { width: tile, height: tile }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.addPlus}>+</Text>
                  <Text style={[type.label, { color: colors.muted }]}>Add photo</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
        {photos.length ? <Text style={[type.small, { color: colors.faint }]}>Tap a photo for full screen · hold to add a note or delete</Text> : null}
        {message ? <Text style={[type.small, { color: colors.markOut }]}>{message}</Text> : null}

        {/* Notes */}
        <View style={[styles.sectionHead, { marginTop: space.xl }]}>
          <Text style={type.heading}>Notes</Text>
          {notes.length ? <Text style={type.small}>Hold a note to edit</Text> : null}
        </View>
        <Pressable onPress={() => setDialog({ kind: "newNote" })} style={({ pressed }) => [styles.addNote, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={[type.button, { color: colors.text }]}>+ Add note</Text>
        </Pressable>
        {notes.length === 0 ? (
          <Text style={[type.small, { color: colors.faint }]}>Power, parking, permits, sound, sun direction… anything the crew should know.</Text>
        ) : null}
        {notes.map((n) => (
          <Pressable
            key={n.id}
            onLongPress={() => setDialog({ kind: "noteMenu", note: n })}
            delayLongPress={350}
            style={({ pressed }) => [styles.note, pressed && { backgroundColor: colors.surfaceRaised }]}
            accessibilityHint="Press and hold to edit or delete"
          >
            <Text style={type.body}>{n.text}</Text>
            <Text style={[type.small, { color: colors.faint }]}>
              {friendlyDate(n.createdAt)} · {formatTimeOfDay(n.createdAt).slice(0, 5)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <PhotoViewer
        photos={photos}
        startIndex={viewerAt}
        onClose={() => setViewerAt(null)}
        onEditNote={(photo) => setDialog({ kind: "photoNote", photo })}
      />

      {/* Add photo: library or camera */}
      <ActionSheet
        visible={dialog?.kind === "addPhoto"}
        title="Add photos"
        message={`${slots} of ${MAX_PHOTOS} left for this location`}
        onClose={() => setDialog(null)}
        actions={[
          { label: "Take photo", onPress: takePhoto },
          { label: "Choose from library", onPress: fromLibrary },
        ]}
      />

      {/* Photo menu (hold) */}
      <ActionSheet
        visible={dialog?.kind === "photoMenu"}
        title="Photo"
        message={dialog?.kind === "photoMenu" && dialog.photo.note ? dialog.photo.note : undefined}
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "photoMenu"
            ? [
                { label: dialog.photo.note ? "Edit note" : "Add note", onPress: () => setDialog({ kind: "photoNote", photo: dialog.photo }) },
                { label: "Delete photo", destructive: true, onPress: () => setDialog({ kind: "confirmPhotoDelete", photo: dialog.photo }) },
              ]
            : []
        }
      />
      <PromptModal
        visible={dialog?.kind === "photoNote"}
        title={dialog?.kind === "photoNote" && dialog.photo.note ? "Edit photo note" : "Add photo note"}
        message="Shown over the photo in full screen."
        placeholder="e.g. Camera position for the wide, facing east"
        initialValue={dialog?.kind === "photoNote" ? dialog.photo.note : ""}
        multiline
        onCancel={() => setDialog(null)}
        onSave={(text) => {
          if (dialog?.kind === "photoNote") setPhotoNote(dialog.photo.id, text);
          setDialog(null);
        }}
      />
      <ActionSheet
        visible={dialog?.kind === "confirmPhotoDelete"}
        title="Delete this photo?"
        message="Removes it for everyone on the project."
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmPhotoDelete"
            ? [{ label: "Delete photo", destructive: true, onPress: () => { removePhoto(dialog.photo); setDialog(null); } }]
            : []
        }
      />

      {/* Notes */}
      <PromptModal
        visible={dialog?.kind === "newNote"}
        title="New note"
        placeholder="Write a note about this location"
        saveLabel="Save note"
        multiline
        onCancel={() => setDialog(null)}
        onSave={(text) => {
          addNote(text);
          setDialog(null);
        }}
      />
      <ActionSheet
        visible={dialog?.kind === "noteMenu"}
        title="Note"
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "noteMenu"
            ? [
                { label: "Edit", onPress: () => setDialog({ kind: "editNote", note: dialog.note }) },
                { label: "Delete", destructive: true, onPress: () => setDialog({ kind: "confirmNoteDelete", note: dialog.note }) },
              ]
            : []
        }
      />
      <PromptModal
        visible={dialog?.kind === "editNote"}
        title="Edit note"
        initialValue={dialog?.kind === "editNote" ? dialog.note.text : ""}
        multiline
        onCancel={() => setDialog(null)}
        onSave={(text) => {
          if (dialog?.kind === "editNote") editNote(dialog.note.id, text);
          setDialog(null);
        }}
      />
      <ActionSheet
        visible={dialog?.kind === "confirmNoteDelete"}
        title="Delete this note?"
        onClose={() => setDialog(null)}
        actions={
          dialog?.kind === "confirmNoteDelete"
            ? [{ label: "Delete note", destructive: true, onPress: () => { removeNote(dialog.note.id); setDialog(null); } }]
            : []
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  addTile: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addPlus: { fontSize: 28, lineHeight: 30, color: colors.text },
  addNote: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.xs,
  },
});
