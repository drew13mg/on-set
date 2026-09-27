import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emptyList, type LibraryItem, type ProjectEquipment } from "./equipment";
import { projectKey } from "./projects-store";

const LIBRARY_KEY = "onset.equipment.library.v1";

type LibraryContextValue = {
  library: LibraryItem[];
  loaded: boolean;
  setLibrary: (update: (lib: LibraryItem[]) => LibraryItem[]) => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

/** "My equipment": saved gear that can be picked in any project. */
export function EquipmentLibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLib] = useState<LibraryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LIBRARY_KEY)
      .then((raw) => {
        if (raw) setLib(JSON.parse(raw) as LibraryItem[]);
      })
      .catch((e) => console.warn("Could not load equipment", e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(library)).catch((e) =>
      console.warn("Could not save equipment", e),
    );
  }, [library, loaded]);

  const setLibrary = useCallback((update: (lib: LibraryItem[]) => LibraryItem[]) => setLib(update), []);
  const value = useMemo(() => ({ library, loaded, setLibrary }), [library, loaded, setLibrary]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useEquipmentLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useEquipmentLibrary must be used inside <EquipmentLibraryProvider>");
  return ctx;
}

/** One project's equipment list, saved on the device (removed with the project). */
export function useProjectEquipment(projectId: string) {
  const key = projectKey(projectId, "equipment");
  const [list, setListState] = useState<ProjectEquipment>(emptyList);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    if (version === 0) setLoaded(false);
    loadedKey.current = version === 0 ? null : loadedKey.current;
    AsyncStorage.getItem(key)
      .then((raw) => setListState(raw ? (JSON.parse(raw) as ProjectEquipment) : emptyList()))
      .catch(() => setListState(emptyList()))
      .finally(() => {
        loadedKey.current = key;
        setLoaded(true);
      });
  }, [key, version]);

  useEffect(() => {
    if (!loaded || loadedKey.current !== key) return;
    AsyncStorage.setItem(key, JSON.stringify(list)).catch((e) => console.warn("Could not save list", e));
  }, [list, loaded, key]);

  const setList = useCallback((update: (l: ProjectEquipment) => ProjectEquipment) => setListState(update), []);
  /** Re-read from storage (e.g. when a screen showing a summary comes back into view). */
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { list, loaded, setList, reload };
}
