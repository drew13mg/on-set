import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "./auth";
import { defaultProjectName, type Project } from "./projects";
import { supabase } from "./supabase";
import { removePhotoFiles } from "./photo-sync";
import { useSync, useSyncVersion } from "./sync/SyncProvider";
import { uuid } from "./id";
import type { ProjectRow } from "./sync/model";

const OPENED_KEY = "onset.projects.lastOpened.v1";

/** Per-project key for small device-only settings. */
export const projectKey = (projectId: string, name: string) => `onset.project.${projectId}.${name}`;

export type ProjectInfo = Project & {
  /** Undefined until the project has been uploaded. */
  ownerId?: string;
  /** You made it (or it hasn't been uploaded yet). */
  isOwner: boolean;
  /** On the server (so it can be shared). */
  isCloud: boolean;
  row: ProjectRow;
};

export class GroupAccessError extends Error {}

type Ctx = {
  projects: ProjectInfo[]; // most recently used first
  loaded: boolean;
  addProject: (name: string) => ProjectInfo;
  renameProject: (id: string, name: string) => void;
  /** Owner: deletes for everyone. Anyone else: leaves the project. */
  removeProject: (id: string) => Promise<void>;
  touchProject: (id: string) => void;
};

const ProjectsContext = createContext<Ctx | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { engine, ready } = useSync();
  const version = useSyncVersion();
  const { me } = useAuth();
  const [opened, setOpened] = useState<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(OPENED_KEY)
      .then((raw) => raw && setOpened(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const touchProject = useCallback((id: string) => {
    setOpened((o) => {
      const next = { ...o, [id]: Date.now() };
      AsyncStorage.setItem(OPENED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const projects = useMemo(() => {
    const list = engine.all("projects").map<ProjectInfo>((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: Math.max(opened[r.id] ?? 0, r.createdAt),
      ownerId: r.ownerId,
      isOwner: !r.ownerId || r.ownerId === me?.id,
      isCloud: !!engine.state.remoteProjects[r.id],
      row: r,
    }));
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, version, opened, me?.id]);

  const addProject = useCallback(
    (name: string) => {
      const row = engine.put("projects", {
        id: uuid(),
        name: name.trim() || defaultProjectName(engine.all("projects")),
        createdAt: Date.now(),
        equipmentSavedAt: null,
        sunPlace: null,
      });
      touchProject(row.id);
      return { id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: Date.now(), isOwner: true, isCloud: false, row };
    },
    [engine, touchProject],
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      const clean = name.trim();
      if (clean) engine.patch("projects", id, { name: clean });
    },
    [engine],
  );

  const removeProject = useCallback(
    async (id: string) => {
      const row = engine.get("projects", id);
      if (!row) return;
      const onServer = !!engine.state.remoteProjects[id];
      const mine = !row.ownerId || row.ownerId === me?.id;

      if (!onServer) {
        engine.purgeProject(id); // never uploaded: just forget it
        return;
      }
      if (mine) {
        // Delete for everyone. Offline? Mark it deleted and let sync finish the job.
        if (engine.remote) {
          const files = engine.all("locationPhotos").filter((p) => p.projectId === id && p.uploaded).map((p) => p.storagePath);
          if (files.length) await removePhotoFiles(files);
          const { error } = await supabase.from("projects").delete().eq("id", id);
          if (!error) {
            engine.purgeProject(id);
            return;
          }
        }
        engine.remove("projects", id);
        return;
      }
      // Someone else's project: leave it.
      if (!me) throw new Error("Sign in to leave a shared project.");
      const { error } = await supabase.from("project_members").delete().eq("project_id", id).eq("email", me.email);
      if (error) throw new Error(error.message);
      const { data } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
      if (data) throw new GroupAccessError("You're on this project through a group. Ask the group's owner to remove you.");
      engine.purgeProject(id);
    },
    [engine, me],
  );

  const value = useMemo(
    () => ({ projects, loaded: ready, addProject, renameProject, removeProject, touchProject }),
    [projects, ready, addProject, renameProject, removeProject, touchProject],
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): Ctx {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return ctx;
}

/** The project whose screens are open (from the /project/[id]/... route). */
export function useCurrentProject(): { id: string; project: ProjectInfo | undefined } {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects } = useProjects();
  const pid = String(id ?? "");
  return { id: pid, project: projects.find((p) => p.id === pid) };
}
