import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Clip } from "./clips";

const STORAGE_KEY = "onset.clips.v1";

type ClipsContextValue = {
  clips: Clip[];
  loaded: boolean;
  addClip: (clip: Clip) => void;
  renameClip: (id: string, name: string) => void;
  removeClip: (id: string) => void;
};

const ClipsContext = createContext<ClipsContextValue | null>(null);

/** Keeps named clips in memory and saves them on the device so they survive restarts. */
export function ClipsProvider({ children }: { children: ReactNode }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setClips(JSON.parse(raw) as Clip[]);
      })
      .catch((e) => console.warn("Could not load clips", e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clips)).catch((e) =>
      console.warn("Could not save clips", e),
    );
  }, [clips, loaded]);

  const addClip = useCallback((clip: Clip) => setClips((cs) => [clip, ...cs]), []);
  const renameClip = useCallback(
    (id: string, name: string) =>
      setClips((cs) => cs.map((c) => (c.id === id && name.trim() ? { ...c, name: name.trim() } : c))),
    [],
  );
  const removeClip = useCallback((id: string) => setClips((cs) => cs.filter((c) => c.id !== id)), []);

  const value = useMemo(
    () => ({ clips, loaded, addClip, renameClip, removeClip }),
    [clips, loaded, addClip, renameClip, removeClip],
  );
  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>;
}

export function useClips(): ClipsContextValue {
  const ctx = useContext(ClipsContext);
  if (!ctx) throw new Error("useClips must be used inside <ClipsProvider>");
  return ctx;
}
