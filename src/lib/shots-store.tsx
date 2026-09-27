import { useCallback, useMemo } from "react";
import { useSync, useSyncVersion } from "./sync/SyncProvider";
import type { ShotListRow, ShotRow, ShotStatus } from "./sync/model";
import { uuid } from "./id";
import { activeList, defaultListName, liveShots, nextShotNumber, shotsToAdd } from "./shots";

/** A project's shot lists (shared with the project team). */
export function useShotLists(projectId: string) {
  const { engine } = useSync();
  const version = useSyncVersion();

  const lists = useMemo(
    () =>
      engine
        .all("shotLists")
        .filter((l) => l.projectId === projectId)
        .sort((a, b) => b.createdAt - a.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version, projectId],
  );
  const shots = useMemo(() => engine.all("shots").filter((s) => s.projectId === projectId), [engine, version, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback(
    (name: string): ShotListRow =>
      engine.put("shotLists", {
        id: uuid(),
        projectId,
        name: name.trim() || defaultListName(engine.all("shotLists").filter((l) => l.projectId === projectId)),
        startedAt: null,
        createdAt: Date.now(),
      }),
    [engine, projectId],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      if (name.trim()) engine.patch("shotLists", id, { name: name.trim() });
    },
    [engine],
  );

  const remove = useCallback(
    (id: string) =>
      engine.batch(() => {
        engine.remove("shotLists", id);
        for (const s of engine.all("shots")) if (s.listId === id) engine.remove("shots", s.id);
      }),
    [engine],
  );

  /** Copy a list and its shots (same numbers, all unchecked, not started). */
  const duplicate = useCallback(
    (id: string, name: string): ShotListRow | null => {
      const src = engine.get("shotLists", id);
      if (!src) return null;
      const now = Date.now();
      let copy: ShotListRow | null = null;
      engine.batch(() => {
        copy = engine.put("shotLists", { id: uuid(), projectId: src.projectId, name, startedAt: null, createdAt: now });
        for (const s of liveShots(engine.all("shots"), id)) {
          engine.put("shots", {
            id: uuid(),
            projectId: src.projectId,
            listId: copy.id,
            number: s.number,
            status: "none",
            description: s.description,
            createdAt: now,
          });
        }
      });
      return copy;
    },
    [engine],
  );

  return { lists, shots, add, rename, remove, duplicate };
}

/** One shot list: its tiles, statuses and Start. */
export function useShotList(projectId: string, listId: string) {
  const { engine } = useSync();
  const version = useSyncVersion();

  const list = useMemo(() => engine.get("shotLists", listId), [engine, version, listId]); // eslint-disable-line react-hooks/exhaustive-deps
  const shots = useMemo(() => liveShots(engine.all("shots"), listId), [engine, version, listId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addShots = useCallback(
    (wanted: number): number => {
      const n = shotsToAdd(engine.all("shots"), listId, wanted);
      if (!n) return 0;
      const now = Date.now();
      engine.batch(() => {
        let next = nextShotNumber(engine.all("shots"), listId);
        for (let i = 0; i < n; i++) {
          engine.put("shots", { id: uuid(), projectId, listId, number: next++, status: "none", description: "", createdAt: now + i });
        }
      });
      return n;
    },
    [engine, projectId, listId],
  );

  const setStatus = useCallback(
    (shotId: string, status: ShotStatus) => {
      const s = engine.get("shots", shotId);
      if (s && s.status !== status) engine.patch("shots", shotId, { status });
    },
    [engine],
  );

  const removeShot = useCallback((shot: ShotRow) => engine.remove("shots", shot.id), [engine]);

  /** Make this the project's active shot list (any other started list is stopped). */
  const start = useCallback(() => {
    const now = Date.now();
    engine.batch(() => {
      for (const l of engine.all("shotLists")) {
        if (l.projectId === projectId && l.id !== listId && l.startedAt != null) engine.patch("shotLists", l.id, { startedAt: null });
      }
      engine.patch("shotLists", listId, { startedAt: now });
    });
  }, [engine, projectId, listId]);

  const stop = useCallback(() => engine.patch("shotLists", listId, { startedAt: null }), [engine, listId]);

  return { list, shots, addShots, setStatus, removeShot, start, stop };
}

/** The project's active (started) shot list and its shots. For tools that follow the shoot live. */
export function useActiveShotList(projectId: string) {
  const { engine } = useSync();
  const version = useSyncVersion();
  return useMemo(() => {
    const list = activeList(engine.all("shotLists"), projectId);
    return { list, shots: list ? liveShots(engine.all("shots"), list.id) : [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, version, projectId]);
}
