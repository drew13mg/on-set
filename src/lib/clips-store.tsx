import { useCallback, useMemo } from "react";
import type { Clip } from "./clips";
import { useSync, useSyncVersion } from "./sync/SyncProvider";

/** All clips on this device (every project), kept in sync with the team. */
export function useClips() {
  const { engine, ready } = useSync();
  const version = useSyncVersion();

  const clips = useMemo(
    () => engine.all("clips") as Clip[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version],
  );

  const addClip = useCallback((clip: Clip) => void engine.put("clips", { ...clip, transcript: clip.transcript ?? "" }), [engine]);
  const renameClip = useCallback(
    (id: string, name: string) => {
      if (name.trim()) engine.patch("clips", id, { name: name.trim() });
    },
    [engine],
  );
  const removeClip = useCallback((id: string) => engine.remove("clips", id), [engine]);
  const removeProjectClips = useCallback(
    (projectId: string) => engine.batch(() => engine.all("clips").forEach((c) => c.projectId === projectId && engine.remove("clips", c.id))),
    [engine],
  );
  const removeTranscriptionClips = useCallback(
    (tid: string) => engine.batch(() => engine.all("clips").forEach((c) => c.transcriptionId === tid && engine.remove("clips", c.id))),
    [engine],
  );

  return { clips, loaded: ready, addClip, renameClip, removeClip, removeProjectClips, removeTranscriptionClips };
}

/** Clips for one project only. */
export function useProjectClips(projectId: string) {
  const store = useClips();
  const clips = useMemo(() => store.clips.filter((c) => c.projectId === projectId), [store.clips, projectId]);
  return { ...store, clips };
}
