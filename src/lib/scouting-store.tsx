import { useCallback, useMemo } from "react";
import { useSync, useSyncVersion } from "./sync/SyncProvider";
import type { LocationNoteRow, LocationPhotoRow, LocationRow } from "./sync/model";
import { uuid } from "./id";
import {
  defaultLocationName,
  liveNotes,
  livePhotos,
  nextPosition,
  photoStoragePath,
  remainingPhotoSlots,
} from "./scouting";
import { deletePhotoFromDevice, keepPhotoOnDevice, preparePhoto } from "./photo-files";
import { removePhotoFiles, uploadPendingPhotos } from "./photo-sync";

/** A project's scouted locations, newest first. */
export function useLocations(projectId: string) {
  const { engine } = useSync();
  const version = useSyncVersion();

  const locations = useMemo(
    () =>
      engine
        .all("locations")
        .filter((l) => l.projectId === projectId)
        .sort((a, b) => b.createdAt - a.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version, projectId],
  );
  const photos = useMemo(() => engine.all("locationPhotos").filter((p) => p.projectId === projectId), [engine, version, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const notes = useMemo(() => engine.all("locationNotes").filter((n) => n.projectId === projectId), [engine, version, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback(
    (name: string): LocationRow =>
      engine.put("locations", {
        id: uuid(),
        projectId,
        name: name.trim() || defaultLocationName(engine.all("locations").filter((l) => l.projectId === projectId)),
        createdAt: Date.now(),
      }),
    [engine, projectId],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      if (name.trim()) engine.patch("locations", id, { name: name.trim() });
    },
    [engine],
  );

  /** Delete a location with its notes and photos, for everyone on the project. */
  const remove = useCallback(
    (id: string) => {
      const gone = engine.all("locationPhotos").filter((p) => p.locationId === id);
      engine.batch(() => {
        engine.remove("locations", id);
        for (const n of engine.all("locationNotes")) if (n.locationId === id) engine.remove("locationNotes", n.id);
        for (const p of gone) engine.remove("locationPhotos", p.id);
      });
      for (const p of gone) deletePhotoFromDevice(p.localUri);
      if (engine.remote) removePhotoFiles(gone.filter((p) => p.uploaded).map((p) => p.storagePath));
    },
    [engine],
  );

  return { locations, photos, notes, add, rename, remove };
}

export type PickedImage = { uri: string; width: number; height: number };

/** One location: its notes and up to 10 photos. */
export function useLocation(projectId: string, locationId: string) {
  const { engine } = useSync();
  const version = useSyncVersion();

  const location = useMemo(() => engine.get("locations", locationId), [engine, version, locationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const photos = useMemo(() => livePhotos(engine.all("locationPhotos"), locationId), [engine, version, locationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const notes = useMemo(() => liveNotes(engine.all("locationNotes"), locationId), [engine, version, locationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const slots = useMemo(() => remainingPhotoSlots(engine.all("locationPhotos"), locationId), [engine, version, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = useCallback(
    (text: string): LocationNoteRow | null => {
      if (!text.trim()) return null;
      return engine.put("locationNotes", { id: uuid(), projectId, locationId, text: text.trim(), createdAt: Date.now() });
    },
    [engine, projectId, locationId],
  );
  const editNote = useCallback(
    (id: string, text: string) => {
      if (text.trim()) engine.patch("locationNotes", id, { text: text.trim() });
    },
    [engine],
  );
  const removeNote = useCallback((id: string) => engine.remove("locationNotes", id), [engine]);

  /** Save picked or taken photos (resized, stored on the phone, uploaded in the background). */
  const addPhotos = useCallback(
    async (images: PickedImage[]): Promise<{ added: number; skipped: number }> => {
      const room = remainingPhotoSlots(engine.all("locationPhotos"), locationId);
      const take = images.slice(0, room);
      let added = 0;
      for (const img of take) {
        const id = uuid();
        const prepared = await preparePhoto(img.uri, img.width, img.height);
        const localUri = await keepPhotoOnDevice(prepared.uri, id);
        engine.put("locationPhotos", {
          id,
          projectId,
          locationId,
          storagePath: photoStoragePath(projectId, locationId, id),
          note: "",
          position: nextPosition(engine.all("locationPhotos"), locationId),
          width: prepared.width,
          height: prepared.height,
          uploaded: false,
          createdAt: Date.now(),
          localUri,
        });
        added++;
      }
      if (engine.remote) setTimeout(() => engine.sync().then(() => uploadPendingPhotos(engine)), 300);
      return { added, skipped: images.length - take.length };
    },
    [engine, projectId, locationId],
  );

  const setPhotoNote = useCallback(
    (id: string, note: string) => engine.patch("locationPhotos", id, { note: note.trim() }),
    [engine],
  );

  const removePhoto = useCallback(
    (photo: LocationPhotoRow) => {
      engine.remove("locationPhotos", photo.id);
      deletePhotoFromDevice(photo.localUri);
      if (engine.remote && photo.uploaded) removePhotoFiles([photo.storagePath]);
    },
    [engine],
  );

  return { location, photos, notes, slots, addNote, editNote, removeNote, addPhotos, setPhotoNote, removePhoto };
}
