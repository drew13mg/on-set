import { useCallback, useMemo } from "react";
import type { TranscriptLine } from "./clips";
import { createTranscription, sortTranscriptions, type Transcription } from "./transcriptions";
import { useSync, useSyncVersion } from "./sync/SyncProvider";

/** All transcriptions on this device with their lines, kept in sync with the team. */
export function useTranscriptions() {
  const { engine, ready } = useSync();
  const version = useSyncVersion();

  const all = useMemo<Transcription[]>(() => {
    const linesBy = new Map<string, TranscriptLine[]>();
    for (const l of engine.all("lines")) {
      const arr = linesBy.get(l.transcriptionId) ?? [];
      arr.push({ id: l.id, text: l.text, at: l.at });
      linesBy.set(l.transcriptionId, arr);
    }
    return engine.all("transcriptions").map((t) => {
      const lines = (linesBy.get(t.id) ?? []).sort((a, b) => a.at - b.at);
      const lastLine = lines.length ? lines[lines.length - 1].at : 0;
      return {
        id: t.id,
        projectId: t.projectId,
        name: t.name,
        createdAt: t.createdAt,
        updatedAt: Math.max(t.updatedMs, lastLine),
        lines,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, version]);

  const add = useCallback(
    (projectId: string, name: string) => {
      const t = createTranscription(projectId, name, all.filter((x) => x.projectId === projectId));
      engine.put("transcriptions", { id: t.id, projectId, name: t.name, createdAt: t.createdAt });
      return t;
    },
    [engine, all],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      if (name.trim()) engine.patch("transcriptions", id, { name: name.trim() });
    },
    [engine],
  );

  /** Delete a transcription with its lines and clips (for everyone on the project). */
  const remove = useCallback(
    (id: string) =>
      engine.batch(() => {
        engine.remove("transcriptions", id);
        for (const l of engine.all("lines")) if (l.transcriptionId === id) engine.remove("lines", l.id);
        for (const c of engine.all("clips")) if (c.transcriptionId === id) engine.remove("clips", c.id);
      }),
    [engine],
  );

  const appendLines = useCallback(
    (transcriptionId: string, lines: TranscriptLine[]) => {
      const t = engine.get("transcriptions", transcriptionId);
      if (!t || !lines.length) return;
      engine.batch(() => {
        for (const l of lines) {
          engine.put("lines", { id: l.id, projectId: t.projectId, transcriptionId, text: l.text, at: l.at });
        }
      });
    },
    [engine],
  );

  return { all, loaded: ready, add, rename, remove, appendLines };
}

/** A project's transcriptions, most recently used first. */
export function useProjectTranscriptions(projectId: string) {
  const store = useTranscriptions();
  const list = useMemo(
    () => sortTranscriptions(store.all.filter((t) => t.projectId === projectId)),
    [store.all, projectId],
  );
  return { ...store, list };
}
