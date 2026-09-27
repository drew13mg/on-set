import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampIndex,
  defaultLocationName,
  liveNotes,
  livePhotos,
  locationSummary,
  MAX_PHOTOS,
  nextPosition,
  pendingUploads,
  photoStoragePath,
  remainingPhotoSlots,
  resizeTarget,
} from "../src/lib/scouting.ts";
import type { LocationPhotoRow } from "../src/lib/sync/model.ts";

const photo = (id: string, over: Partial<LocationPhotoRow> = {}): LocationPhotoRow => ({
  id,
  projectId: "p1",
  locationId: "L1",
  storagePath: `p1/L1/${id}.jpg`,
  note: "",
  position: Number(id.replace(/\D/g, "")) || 0,
  width: 100,
  height: 100,
  uploaded: false,
  createdAt: 1,
  updatedMs: 1,
  deleted: false,
  ...over,
});

test("storage path", () => {
  assert.equal(photoStoragePath("p", "l", "x"), "p/l/x.jpg");
});

test("10 photo limit counts only live photos in that location", () => {
  const photos = Array.from({ length: 9 }, (_, i) => photo(`ph${i + 1}`));
  photos.push(photo("gone", { deleted: true }));
  photos.push(photo("other", { locationId: "L2" }));
  assert.equal(MAX_PHOTOS, 10);
  assert.equal(remainingPhotoSlots(photos, "L1"), 1);
  photos.push(photo("ph10"));
  assert.equal(remainingPhotoSlots(photos, "L1"), 0);
  photos.push(photo("ph11"));
  assert.equal(remainingPhotoSlots(photos, "L1"), 0);
  assert.equal(remainingPhotoSlots(photos, "L2"), 9);
});

test("photos are ordered and new ones go last", () => {
  const photos = [photo("ph3"), photo("ph1"), photo("ph2", { deleted: true })];
  assert.deepEqual(livePhotos(photos, "L1").map((p) => p.id), ["ph1", "ph3"]);
  assert.equal(nextPosition(photos, "L1"), 4);
  assert.equal(nextPosition([], "L1"), 1);
});

test("notes in the order they were written", () => {
  const n = (id: string, createdAt: number, deleted = false) => ({ id, projectId: "p1", locationId: "L1", text: id, createdAt, updatedMs: 1, deleted });
  assert.deepEqual(liveNotes([n("b", 2), n("a", 1), n("c", 3, true)], "L1").map((x) => x.id), ["a", "b"]);
});

test("summary and default names", () => {
  assert.equal(locationSummary(1, 0), "1 photo · 0 notes");
  assert.equal(locationSummary(4, 2), "4 photos · 2 notes");
  assert.equal(defaultLocationName([]), "Location 1");
  assert.equal(defaultLocationName([{ name: "Rooftop" }, { name: "Location 2" }]), "Location 3");
});

test("only photos from this phone, not yet uploaded, in cloud projects, are pending", () => {
  const photos = [
    photo("a", { localUri: "file:///a.jpg" }),
    photo("b", { localUri: "file:///b.jpg", uploaded: true }),
    photo("c"), // taken on another phone
    photo("d", { localUri: "file:///d.jpg", deleted: true }),
    photo("e", { localUri: "file:///e.jpg", projectId: "local-only" }),
  ];
  assert.deepEqual(pendingUploads(photos, { p1: true }).map((p) => p.id), ["a"]);
});

test("resize keeps the longest edge at 2048", () => {
  assert.deepEqual(resizeTarget(4032, 3024), { width: 2048 });
  assert.deepEqual(resizeTarget(3024, 4032), { height: 2048 });
  assert.equal(resizeTarget(1600, 1200), null);
  assert.equal(resizeTarget(0, 0), null);
});

test("swipe index stays in range", () => {
  assert.equal(clampIndex(-1, 5), 0);
  assert.equal(clampIndex(7, 5), 4);
  assert.equal(clampIndex(2, 5), 2);
});
