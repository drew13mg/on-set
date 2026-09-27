// Equipment tracker logic. Pure (no React), tested in tests/equipment.test.ts.
//
// Two layers:
//  - The library: "My equipment", saved once and selectable in any project.
//  - A project's list: the items picked for that project, each with a "have it" check.
// Items picked from the library keep a link to it, so renaming saved gear updates
// every project that uses it.
import { makeId } from "./clips.ts";

export type LibraryItem = { id: string; name: string };

export type ListItem = {
  id: string;
  /** Name at the time it was added (used if the library item is later deleted). */
  name: string;
  /** Set when the item came from (or was saved to) the library. */
  libraryId?: string;
  have: boolean;
};

export type ProjectEquipment = {
  items: ListItem[];
  /** When the list was last saved as a checklist; null while still being built. */
  savedAt: number | null;
};

export const emptyList = (): ProjectEquipment => ({ items: [], savedAt: null });

const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const same = (a: string, b: string) => norm(a).toLowerCase() === norm(b).toLowerCase();

/** Library sorted A–Z for the chip list. */
export function sortLibrary(lib: LibraryItem[]): LibraryItem[] {
  return [...lib].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Chips matching what's typed (all of them when the box is empty). */
export function filterLibrary(lib: LibraryItem[], query: string): LibraryItem[] {
  const q = norm(query).toLowerCase();
  const sorted = sortLibrary(lib);
  return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
}

/** Display name: the library's current name when linked, otherwise the item's own. */
export function displayName(item: ListItem, lib: LibraryItem[]): string {
  if (item.libraryId) {
    const l = lib.find((x) => x.id === item.libraryId);
    if (l) return l.name;
  }
  return item.name;
}

export function isSelected(list: ProjectEquipment, libraryId: string): boolean {
  return list.items.some((i) => i.libraryId === libraryId);
}

/** Tap a saved-equipment chip: add it to the project, or take it off. */
export function toggleLibraryItem(list: ProjectEquipment, item: LibraryItem): ProjectEquipment {
  if (isSelected(list, item.id)) {
    return { ...list, items: list.items.filter((i) => i.libraryId !== item.id) };
  }
  return { ...list, items: [...list.items, { id: makeId(), name: item.name, libraryId: item.id, have: false }] };
}

/**
 * Add typed equipment to the project. If it matches saved equipment, that item is
 * selected instead of making a duplicate. With `saveToLibrary`, new names are
 * also saved for future projects.
 */
export function addTyped(
  list: ProjectEquipment,
  lib: LibraryItem[],
  rawName: string,
  saveToLibrary: boolean,
): { list: ProjectEquipment; lib: LibraryItem[] } {
  const name = norm(rawName);
  if (!name) return { list, lib };

  const existingLib = lib.find((l) => same(l.name, name));
  if (existingLib) {
    return {
      lib,
      list: isSelected(list, existingLib.id)
        ? list
        : { ...list, items: [...list.items, { id: makeId(), name: existingLib.name, libraryId: existingLib.id, have: false }] },
    };
  }

  // Already on this project as a one-off: just save it to the library if asked.
  const oneOff = list.items.find((i) => !i.libraryId && same(i.name, name));
  if (oneOff) {
    if (!saveToLibrary) return { list, lib };
    const libItem = { id: makeId(), name: oneOff.name };
    return {
      lib: [...lib, libItem],
      list: { ...list, items: list.items.map((i) => (i.id === oneOff.id ? { ...i, libraryId: libItem.id } : i)) },
    };
  }

  if (saveToLibrary) {
    const libItem = { id: makeId(), name };
    return {
      lib: [...lib, libItem],
      list: { ...list, items: [...list.items, { id: makeId(), name, libraryId: libItem.id, have: false }] },
    };
  }
  return { lib, list: { ...list, items: [...list.items, { id: makeId(), name, have: false }] } };
}

export function renameLibraryItem(lib: LibraryItem[], id: string, rawName: string): LibraryItem[] {
  const name = norm(rawName);
  if (!name) return lib;
  return lib.map((l) => (l.id === id ? { ...l, name } : l));
}

/** Remove saved equipment. Projects already using it keep it (under its last name). */
export function removeLibraryItem(lib: LibraryItem[], id: string): LibraryItem[] {
  return lib.filter((l) => l.id !== id);
}

/** Before deleting a library item, copy its current name into a project's linked items. */
export function detachLibraryItem(list: ProjectEquipment, lib: LibraryItem[], libraryId: string): ProjectEquipment {
  const l = lib.find((x) => x.id === libraryId);
  return {
    ...list,
    items: list.items.map((i) => (i.libraryId === libraryId ? { ...i, name: l?.name ?? i.name, libraryId: undefined } : i)),
  };
}

export function renameListItem(list: ProjectEquipment, id: string, rawName: string): ProjectEquipment {
  const name = norm(rawName);
  if (!name) return list;
  return { ...list, items: list.items.map((i) => (i.id === id ? { ...i, name } : i)) };
}

export function removeListItem(list: ProjectEquipment, id: string): ProjectEquipment {
  return { ...list, items: list.items.filter((i) => i.id !== id) };
}

export function toggleHave(list: ProjectEquipment, id: string): ProjectEquipment {
  return { ...list, items: list.items.map((i) => (i.id === id ? { ...i, have: !i.have } : i)) };
}

export function clearChecks(list: ProjectEquipment): ProjectEquipment {
  return { ...list, items: list.items.map((i) => ({ ...i, have: false })) };
}

export function saveList(list: ProjectEquipment, now = Date.now()): ProjectEquipment {
  return { ...list, savedAt: now };
}

export function progress(list: ProjectEquipment): { have: number; total: number } {
  return { have: list.items.filter((i) => i.have).length, total: list.items.length };
}

/** One-off items (not in the library) on this project. */
export function oneOffs(list: ProjectEquipment): ListItem[] {
  return list.items.filter((i) => !i.libraryId);
}
