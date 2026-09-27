// Projects: each production gets its own clips, sun-tracker location, and future tool data.
// Pure logic (no React), tested in tests/projects.test.ts.
import { makeId } from "./clips.ts";

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  /** Last opened or edited; the projects list is sorted by this. */
  updatedAt: number;
};

/** "Untitled project", "Untitled project 2", ... skipping names already used. */
export function defaultProjectName(existing: Pick<Project, "name">[]): string {
  const used = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  if (!used.has("untitled project")) return "Untitled project";
  let n = 2;
  while (used.has(`untitled project ${n}`)) n++;
  return `Untitled project ${n}`;
}

export function createProject(name: string, existing: Project[], now = Date.now()): Project {
  return {
    id: makeId(),
    name: name.trim() || defaultProjectName(existing),
    createdAt: now,
    updatedAt: now,
  };
}

/** Most recently used first. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Yesterday", "Sep 12" or "Sep 12, 2025" relative to now (device calendar). */
export function friendlyDate(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const n = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(n) - startOf(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === n.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}
