import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocalSearchParams } from "expo-router";
import { createProject, sortProjects, type Project } from "./projects";
import { useClips } from "./clips-store";

const STORAGE_KEY = "onset.projects.v1";

/** Per-project key for small tool settings (e.g. the Sun Tracker's location). */
export const projectKey = (projectId: string, name: string) => `onset.project.${projectId}.${name}`;

type ProjectsContextValue = {
  projects: Project[]; // most recently used first
  loaded: boolean;
  addProject: (name: string) => Project;
  renameProject: (id: string, name: string) => void;
  removeProject: (id: string) => void;
  touchProject: (id: string) => void;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { removeProjectClips } = useClips();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setProjects(JSON.parse(raw) as Project[]);
      })
      .catch((e) => console.warn("Could not load projects", e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects)).catch((e) =>
      console.warn("Could not save projects", e),
    );
  }, [projects, loaded]);

  const addProject = useCallback(
    (name: string) => {
      const p = createProject(name, projects);
      setProjects((ps) => [p, ...ps]);
      return p;
    },
    [projects],
  );

  const renameProject = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name: clean, updatedAt: Date.now() } : p)));
  }, []);

  const touchProject = useCallback((id: string) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p)));
  }, []);

  const removeProject = useCallback(
    (id: string) => {
      setProjects((ps) => ps.filter((p) => p.id !== id));
      removeProjectClips(id);
      AsyncStorage.getAllKeys()
        .then((keys) => AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(`onset.project.${id}.`))))
        .catch(() => {});
    },
    [removeProjectClips],
  );

  const sorted = useMemo(() => sortProjects(projects), [projects]);
  const value = useMemo(
    () => ({ projects: sorted, loaded, addProject, renameProject, removeProject, touchProject }),
    [sorted, loaded, addProject, renameProject, removeProject, touchProject],
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return ctx;
}

/** The project whose screens are open (from the /project/[id]/... route). */
export function useCurrentProject(): { id: string; project: Project | undefined } {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects } = useProjects();
  const pid = String(id ?? "");
  return { id: pid, project: projects.find((p) => p.id === pid) };
}
