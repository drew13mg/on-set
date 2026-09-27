import { useEffect, useState } from "react";
import type { SyncEngine } from "./sync/engine";
import type { LocationPhotoRow } from "./sync/model";
import { supabase } from "./supabase";
import { pendingUploads } from "./scouting";
import { photoExistsOnDevice, readPhotoBytes } from "./photo-files";

export const PHOTO_BUCKET = "location-photos";

let uploading = false;

/** Upload photos taken on this phone, one at a time. Safe to call often; retries next time on failure. */
export async function uploadPendingPhotos(engine: SyncEngine): Promise<void> {
  if (uploading || !engine.remote) return;
  uploading = true;
  try {
    for (const photo of pendingUploads(engine.all("locationPhotos"), engine.state.remoteProjects)) {
      if (!photoExistsOnDevice(photo.localUri)) continue;
      // The row must be on the server first (it's what grants access to the file path).
      if (engine.isDirty("locationPhotos", photo.id) || engine.isDirty("locations", photo.locationId)) continue;
      try {
        const bytes = await readPhotoBytes(photo.localUri!);
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(photo.storagePath, bytes, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        engine.patch("locationPhotos", photo.id, { uploaded: true });
      } catch (e) {
        console.warn("Photo upload will retry", e);
        break; // probably offline; try again on the next sync
      }
    }
  } finally {
    uploading = false;
  }
}

export async function removePhotoFiles(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(PHOTO_BUCKET).remove(paths).catch(() => {});
}

// Short-lived links for photos stored in the cloud (the bucket is private).
const urlCache = new Map<string, { url: string; expires: number }>();
const LINK_SECONDS = 60 * 60;

async function signedUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.expires > Date.now() + 5 * 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, LINK_SECONDS);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + LINK_SECONDS * 1000 });
  return data.signedUrl;
}

export type PhotoSource = { uri: string; cacheKey: string } | null;

/**
 * Where to load a photo from: the file on this phone if it's here, otherwise the cloud
 * copy (cached on disk by storage path, so it keeps working offline once seen).
 * `null` while a teammate's phone is still uploading it.
 */
export function usePhotoSource(photo: LocationPhotoRow | undefined): { source: PhotoSource; waiting: boolean } {
  const local = photo?.localUri && photoExistsOnDevice(photo.localUri) ? photo.localUri : null;
  const [remote, setRemote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!photo || local || !photo.uploaded) {
      setRemote(null);
      return;
    }
    signedUrl(photo.storagePath).then((u) => alive && setRemote(u));
    return () => {
      alive = false;
    };
  }, [photo?.storagePath, photo?.uploaded, local]);

  if (!photo) return { source: null, waiting: false };
  if (local) return { source: { uri: local, cacheKey: photo.storagePath }, waiting: false };
  if (remote) return { source: { uri: remote, cacheKey: photo.storagePath }, waiting: false };
  return { source: null, waiting: !photo.uploaded };
}
