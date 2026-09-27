import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TranscriptLine } from "./clips";
import { useClips } from "./clips-store";
import { createTranscription, sortTranscriptions, type Transcription } from "./transcriptions";

const STORAGE_KEY = "onset.transcriptions.v1";
const SAVE_DELAY_MS = 800; // transcripts change every few seconds while recording; batch the writes

type Ctx = {
  all: Transcription[];
  loaded: boolean;
  add: (projectId: string, name: string) => Transcription;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  removeForProject: (projectId: string) => void;
  appendLines: (id: string, lines: TranscriptLine[]) => void;
};

const TranscriptionsContext = createContext<Ctx | null>(null);

export function TranscriptionsProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<Transcription[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { removeTranscriptionClips } = useClips();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Transcription[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setAll(JSON.parse(raw) as Transcription[]);
      })
      .catch((e) => console.warn("Could not load transcriptions", e))
      .finally(() => setLoaded(true));
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current)).catch((e) =>
      console.warn("Could not save transcriptions", e),
    );
  }, []);

  useEffect(() => {
    latest.current = all;
    if (!loaded) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [all, loaded, flush]);

  // Don't lose the last few lines if the app is closed or backgrounded right after a change.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && timer.current) flush();
    });
    return () => {
      sub.remove();
      if (timer.current) flush();
    };
  }, [flush]);

  const add = useCallback(
    (projectId: string, name: string) => {
      const t = createTranscription(projectId, name, all.filter((x) => x.projectId === projectId));
      setAll((xs) => [t, ...xs]);
      return t;
    },
    [all],
  );
  const rename = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setAll((xs) => xs.map((t) => (t.id === id ? { ...t, name: clean, updatedAt: Date.now() } : t)));
  }, []);
  const remove = useCallback(
    (id: string) => {
      setAll((xs) => xs.filter((t) => t.id !== id));
      removeTranscriptionClips(id);
    },
    [removeTranscriptionClips],
  );
  const removeForProject = useCallback(
    (projectId: string) => setAll((xs) => xs.filter((t) => t.projectId !== projectId)),
    [],
  );
  const appendLines = useCallback((id: string, lines: TranscriptLine[]) => {
    if (!lines.length) return;
    setAll((xs) =>
      xs.map((t) => (t.id === id ? { ...t, lines: [...t.lines, ...lines], updatedAt: Date.now() } : t)),
    );
  }, []);

  const value = useMemo(
    () => ({ all, loaded, add, rename, remove, removeForProject, appendLines }),
    [all, loaded, add, rename, remove, removeForProject, appendLines],
  );
  return <TranscriptionsContext.Provider value={value}>{children}</TranscriptionsContext.Provider>;
}

export function useTranscriptions(): Ctx {
  const ctx = useContext(TranscriptionsContext);
  if (!ctx) throw new Error("useTranscriptions must be used inside <TranscriptionsProvider>");
  return ctx;
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
