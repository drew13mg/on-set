import { useCallback, useMemo } from "react";
import type { LibraryItem, ListItem, ProjectEquipment } from "./equipment";
import { useSync, useSyncVersion } from "./sync/SyncProvider";

/** "My equipment": your saved gear, synced across your own devices (not shared). */
export function useEquipmentLibrary() {
  const { engine, ready } = useSync();
  const version = useSyncVersion();

  const library = useMemo<LibraryItem[]>(
    () => engine.all("library").map((l) => ({ id: l.id, name: l.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version],
  );

  /** Apply a change computed by the pure equipment helpers; only the differences are saved. */
  const setLibrary = useCallback(
    (update: (lib: LibraryItem[]) => LibraryItem[]) => {
      const before = engine.all("library").map((l) => ({ id: l.id, name: l.name }));
      const after = update(before);
      const beforeById = new Map(before.map((l) => [l.id, l]));
      const afterIds = new Set(after.map((l) => l.id));
      engine.batch(() => {
        for (const l of after) {
          const old = beforeById.get(l.id);
          if (!old) engine.put("library", { id: l.id, name: l.name });
          else if (old.name !== l.name) engine.patch("library", l.id, { name: l.name });
        }
        for (const l of before) if (!afterIds.has(l.id)) engine.remove("library", l.id);
      });
    },
    [engine],
  );

  return { library, loaded: ready, setLibrary };
}

/** One project's equipment list, shared with everyone on the project. */
export function useProjectEquipment(projectId: string) {
  const { engine, ready } = useSync();
  const version = useSyncVersion();

  const read = useCallback((): ProjectEquipment => {
    const items = engine
      .all("equipment")
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => a.position - b.position)
      .map<ListItem>((e) => ({ id: e.id, name: e.name, libraryId: e.libraryId, have: e.have }));
    return { items, savedAt: engine.get("projects", projectId)?.equipmentSavedAt ?? null };
  }, [engine, projectId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(read, [read, version]);

  const setList = useCallback(
    (update: (l: ProjectEquipment) => ProjectEquipment) => {
      const before = read();
      const after = update(before);
      const beforeById = new Map(before.items.map((i) => [i.id, i]));
      const afterIds = new Set(after.items.map((i) => i.id));
      const maxPos = Math.max(0, ...engine.all("equipment").filter((e) => e.projectId === projectId).map((e) => e.position));
      let next = maxPos;
      engine.batch(() => {
        for (const i of after.items) {
          const old = beforeById.get(i.id);
          if (!old) {
            engine.put("equipment", { id: i.id, projectId, name: i.name, libraryId: i.libraryId, have: i.have, position: ++next });
          } else if (old.name !== i.name || old.have !== i.have || old.libraryId !== i.libraryId) {
            engine.patch("equipment", i.id, { name: i.name, have: i.have, libraryId: i.libraryId });
          }
        }
        for (const i of before.items) if (!afterIds.has(i.id)) engine.remove("equipment", i.id);
        if (after.savedAt !== before.savedAt) engine.patch("projects", projectId, { equipmentSavedAt: after.savedAt });
      });
    },
    [engine, projectId, read],
  );

  const reload = useCallback(() => {}, []);
  return { list, loaded: ready, setList, reload };
}
