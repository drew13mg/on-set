// Location Scouting logic. Pure (no React / native), tested in tests/scouting.test.ts.
import type { LocationNoteRow, LocationPhotoRow, LocationRow } from "./sync/model.ts";

export const MAX_PHOTOS = 10;
/** Longest edge of a stored photo, in pixels. Keeps uploads quick on set. */
export const MAX_PHOTO_EDGE = 2048;

export function photoStoragePath(projectId: string, locationId: string, photoId: string): string {
  return `${projectId}/${locationId}/${photoId}.jpg`;
}

export const livePhotos = (photos: LocationPhotoRow[], locationId: string) =>
  photos
    .filter((p) => p.locationId === locationId && !p.deleted)
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);

export const liveNotes = (notes: LocationNoteRow[], locationId: string) =>
  notes.filter((n) => n.locationId === locationId && !n.deleted).sort((a, b) => a.createdAt - b.createdAt);

/** How many more photos a location can take. */
export function remainingPhotoSlots(photos: LocationPhotoRow[], locationId: string): number {
  return Math.max(0, MAX_PHOTOS - livePhotos(photos, locationId).length);
}

export function nextPosition(photos: LocationPhotoRow[], locationId: string): number {
  const live = livePhotos(photos, locationId);
  return live.length ? live[live.length - 1].position + 1 : 1;
}

/** "4 photos · 2 notes" */
export function locationSummary(photoCount: number, noteCount: number): string {
  const p = photoCount === 1 ? "1 photo" : `${photoCount} photos`;
  const n = noteCount === 1 ? "1 note" : `${noteCount} notes`;
  return `${p} · ${n}`;
}

/** "Location 1", "Location 2", ... skipping names already used. */
export function defaultLocationName(existing: Pick<LocationRow, "name">[]): string {
  const used = new Set(existing.map((l) => l.name.trim().toLowerCase()));
  let n = existing.length + 1;
  while (used.has(`location ${n}`)) n++;
  return `Location ${n}`;
}

/** Photos taken on this device that still need to reach cloud storage. */
export function pendingUploads(photos: LocationPhotoRow[], cloudProjects: Record<string, true>): LocationPhotoRow[] {
  return photos.filter((p) => !p.deleted && !p.uploaded && !!p.localUri && !!cloudProjects[p.projectId]);
}

/** Size to resize a photo to so its longest edge is at most `max` (null = leave as is). */
export function resizeTarget(width: number, height: number, max = MAX_PHOTO_EDGE): { width: number } | { height: number } | null {
  if (!width || !height || Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

/** Index to show after swiping, clamped to the ends. */
export function clampIndex(i: number, count: number): number {
  return Math.max(0, Math.min(count - 1, i));
}
