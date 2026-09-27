import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addTyped,
  clearChecks,
  detachLibraryItem,
  displayName,
  emptyList,
  filterLibrary,
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
} from "../src/lib/equipment.ts";

test("typed equipment is saved to the library and selected", () => {
  const r = addTyped(emptyList(), [], "  Sony   FX6 ", true);
  assert.equal(r.lib.length, 1);
  assert.equal(r.lib[0].name, "Sony FX6");
  assert.equal(r.list.items.length, 1);
  assert.equal(r.list.items[0].libraryId, r.lib[0].id);
  assert.equal(r.list.items[0].have, false);
});

test("typed equipment without saving stays a one-off", () => {
  const r = addTyped(emptyList(), [], "Rental dolly", false);
  assert.equal(r.lib.length, 0);
  assert.equal(oneOffs(r.list).length, 1);
});

test("typing a saved name selects it instead of duplicating", () => {
  const lib: LibraryItem[] = [{ id: "L1", name: "C-stand" }];
  const r1 = addTyped(emptyList(), lib, "c-STAND", true);
  assert.equal(r1.lib.length, 1);
  assert.equal(r1.list.items[0].libraryId, "L1");
  const r2 = addTyped(r1.list, r1.lib, "C-stand", true);
  assert.equal(r2.list.items.length, 1);
});

test("typing a one-off again with save on promotes it to the library", () => {
  const a = addTyped(emptyList(), [], "Haze machine", false);
  const b = addTyped(a.list, a.lib, "haze machine", true);
  assert.equal(b.lib.length, 1);
  assert.equal(b.list.items.length, 1);
  assert.equal(b.list.items[0].libraryId, b.lib[0].id);
});

test("empty input does nothing", () => {
  const list = emptyList();
  const r = addTyped(list, [], "   ", true);
  assert.equal(r.list, list);
});

test("library chips toggle on and off", () => {
  const item = { id: "L1", name: "Sandbags" };
  const on = toggleLibraryItem(emptyList(), item);
  assert.equal(on.items.length, 1);
  const off = toggleLibraryItem(on, item);
  assert.equal(off.items.length, 0);
});

test("filter and sort library", () => {
  const lib = [
    { id: "1", name: "sandbag" },
    { id: "2", name: "Apple box" },
    { id: "3", name: "Sand timer" },
  ];
  assert.deepEqual(filterLibrary(lib, "").map((i) => i.name), ["Apple box", "Sand timer", "sandbag"]);
  assert.deepEqual(filterLibrary(lib, " SAND ").map((i) => i.id), ["3", "1"]);
});

test("renaming saved equipment updates the project display", () => {
  const r = addTyped(emptyList(), [], "Fx6", true);
  const lib = renameLibraryItem(r.lib, r.lib[0].id, "Sony FX6");
  assert.equal(displayName(r.list.items[0], lib), "Sony FX6");
  assert.equal(renameLibraryItem(lib, r.lib[0].id, "  "), lib);
});

test("deleting saved equipment keeps it on projects under its last name", () => {
  const r = addTyped(emptyList(), [], "Fx6", true);
  const lib = renameLibraryItem(r.lib, r.lib[0].id, "Sony FX6");
  const list = detachLibraryItem(r.list, lib, r.lib[0].id);
  const lib2 = removeLibraryItem(lib, r.lib[0].id);
  assert.equal(lib2.length, 0);
  assert.equal(list.items[0].libraryId, undefined);
  assert.equal(displayName(list.items[0], lib2), "Sony FX6");
});

test("checklist: check, progress, rename, remove, clear, save", () => {
  let list = addTyped(emptyList(), [], "Tripod", false).list;
  list = addTyped(list, [], "Monitor", false).list;
  const [tripod, monitor] = list.items;
  list = toggleHave(list, tripod.id);
  assert.deepEqual(progress(list), { have: 1, total: 2 });
  list = renameListItem(list, monitor.id, "7in monitor");
  assert.equal(list.items[1].name, "7in monitor");
  list = clearChecks(list);
  assert.deepEqual(progress(list), { have: 0, total: 2 });
  list = removeListItem(list, tripod.id);
  assert.equal(list.items.length, 1);
  assert.equal(saveList(list, 42).savedAt, 42);
});
