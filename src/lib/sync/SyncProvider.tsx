import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "../auth";
import { supabase, supabaseRemote } from "../supabase";
import { SyncEngine, type Snapshot, type SyncStatus } from "./engine";
import { REMOTE_NAME, type TableName } from "./model";
import { uploadPendingPhotos } from "../photo-sync";
import { clearPhotosFromDevice } from "../photo-files";

const STORE_KEY = "onset.sync.v1";
const USER_KEY = "onset.sync.user";
const SAVE_DELAY_MS = 600;
const PUSH_DELAY_MS = 1500;
const PHOTO_DELAY_MS = 2500;
const POLL_MS = 60_000;
const SHARING_TABLES = ["project_members", "project_groups", "group_members", "user_groups"];

type Ctx = {
  engine: SyncEngine;
  ready: boolean;
  /** Bumps whenever sharing changes on the server (members, groups), so sharing screens can refresh. */
  sharingVersion: number;
};

const SyncContext = createContext<Ctx | null>(null);

/**
 * Owns the device's copy of all project data. Works fully offline; when signed in it
 * uploads changes, pulls teammates' changes, and listens for live updates.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new SyncEngine(), []);
  const [ready, setReady] = useState(false);
  const [sharingVersion, setSharingVersion] = useState(0);
  const { me, ready: authReady } = useAuth();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the device copy.
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        if (raw) engine.load(JSON.parse(raw) as Snapshot);
      })
      .catch((e) => console.warn("Could not load data", e))
      .finally(() => setReady(true));
  }, [engine]);

  // Save the device copy (batched), and push changes to the server shortly after they happen.
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      AsyncStorage.setItem(STORE_KEY, JSON.stringify(engine.state)).catch((e) => console.warn("Could not save", e));
    };
    const unsub = engine.subscribe(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(save, SAVE_DELAY_MS);
      if (engine.remote && engine.status.pending > 0 && !engine.status.syncing) {
        if (pushTimer.current) clearTimeout(pushTimer.current);
        pushTimer.current = setTimeout(() => engine.sync(), PUSH_DELAY_MS);
      }
      // Photos upload after their rows have synced.
      if (engine.remote && !engine.status.syncing) {
        if (photoTimer.current) clearTimeout(photoTimer.current);
        photoTimer.current = setTimeout(() => uploadPendingPhotos(engine), PHOTO_DELAY_MS);
      }
    });
    const app = AppState.addEventListener("change", (s) => {
      if (s !== "active" && saveTimer.current) save();
      if (s === "active" && engine.remote) engine.sync();
    });
    return () => {
      unsub();
      app.remove();
      if (saveTimer.current) save();
    };
  }, [engine, ready]);

  // Connect to the server while signed in.
  useEffect(() => {
    if (!ready || !authReady) return;
    if (!me) {
      engine.setRemote(null);
      return;
    }
    let channel: RealtimeChannel | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      // A different person signing in on this phone shouldn't inherit the last person's shared data.
      const lastUser = await AsyncStorage.getItem(USER_KEY);
      if (lastUser && lastUser !== me.id) {
        engine.reset();
        await AsyncStorage.removeItem(STORE_KEY);
      }
      await AsyncStorage.setItem(USER_KEY, me.id);
      if (cancelled) return;

      engine.setRemote(supabaseRemote());
      engine.sync();

      channel = supabase.channel(`onset-${me.id}`);
      for (const [local, remoteName] of Object.entries(REMOTE_NAME) as [TableName, string][]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table: remoteName }, (payload) => {
          if (payload.eventType === "DELETE") engine.sync();
          else engine.merge(local, payload.new as Record<string, unknown>);
        });
      }
      for (const t of SHARING_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
          setSharingVersion((v) => v + 1);
          engine.sync();
        });
      }
      channel.subscribe();
      poll = setInterval(() => engine.sync(), POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (channel) supabase.removeChannel(channel);
      engine.setRemote(null);
    };
  }, [engine, ready, authReady, me?.id]);

  const value = useMemo(() => ({ engine, ready, sharingVersion }), [engine, ready, sharingVersion]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): Ctx {
  const c = useContext(SyncContext);
  if (!c) throw new Error("useSync must be used inside <SyncProvider>");
  return c;
}

/** Re-render whenever synced data changes. Returns a counter to key memos on. */
export function useSyncVersion(): number {
  const { engine } = useSync();
  const version = useRef(0);
  const subscribe = useMemo(
    () => (cb: () => void) =>
      engine.subscribe(() => {
        version.current++;
        cb();
      }),
    [engine],
  );
  return useSyncExternalStore(subscribe, () => version.current, () => version.current);
}

export function useSyncStatus(): SyncStatus {
  const { engine } = useSync();
  useSyncVersion();
  return engine.status;
}

/** Wipe this device's copy (used on sign out). */
export async function clearDeviceData(engine: SyncEngine) {
  engine.reset();
  clearPhotosFromDevice();
  await AsyncStorage.multiRemove([STORE_KEY, USER_KEY]);
}
