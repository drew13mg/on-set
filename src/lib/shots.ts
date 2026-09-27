// Shot List logic. Pure (no React), tested in tests/shots.test.ts.
import type { ShotListRow, ShotRow, ShotStatus } from "./sync/model.ts";

export const COLUMNS = 3;
export const MAX_ROWS = 40;
/** 3 across × 40 down. */
export const MAX_SHOTS = COLUMNS * MAX_ROWS;

export const liveShots = (shots: ShotRow[], listId: string) =>
  shots.filter((s) => s.listId === listId && !s.deleted).sort((a, b) => a.number - b.number);

/** Numbers stay with their shot (like paperwork); a new shot gets the next number after the highest. */
export function nextShotNumber(shots: ShotRow[], listId: string): number {
  const live = liveShots(shots, listId);
  return live.length ? live[live.length - 1].number + 1 : 1;
}

/** How many shots can still be added to a list, capped at `wanted`. */
export function shotsToAdd(shots: ShotRow[], listId: string, wanted: number): number {
  const room = MAX_SHOTS - liveShots(shots, listId).length;
  return Math.max(0, Math.min(room, Math.floor(wanted)));
}

export type Progress = { total: number; done: number; active: number; open: number };

export function listProgress(shots: ShotRow[], listId: string): Progress {
  const live = liveShots(shots, listId);
  const done = live.filter((s) => s.status === "done").length;
  const active = live.filter((s) => s.status === "active").length;
  return { total: live.length, done, active, open: live.length - done - active };
}

/** "12 shots · 5 done · 1 active" */
export function progressLabel(p: Progress): string {
  if (!p.total) return "No shots yet";
  const parts = [p.total === 1 ? "1 shot" : `${p.total} shots`, `${p.done} done`];
  if (p.active) parts.push(`${p.active} active`);
  return parts.join(" · ");
}

/** "Day 1 copy", "Day 1 copy 2", ... not clashing with existing list names. */
export function duplicateName(name: string, existing: Pick<ShotListRow, "name">[]): string {
  const used = new Set(existing.map((l) => l.name.trim().toLowerCase()));
  const base = `${name.trim()} copy`;
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** "Shot list 1", "Shot list 2", ... */
export function defaultListName(existing: Pick<ShotListRow, "name">[]): string {
  const used = new Set(existing.map((l) => l.name.trim().toLowerCase()));
  let n = existing.length + 1;
  while (used.has(`shot list ${n}`)) n++;
  return `Shot list ${n}`;
}

/** Action buttons at the bottom of a list. */
export const ACTION_STATUS = { done: "done", active: "active", uncheck: "none" } as const satisfies Record<string, ShotStatus>;

/** The project's active (started) list, if any. Only one list is active at a time. */
export function activeList(lists: ShotListRow[], projectId: string): ShotListRow | undefined {
  return lists
    .filter((l) => l.projectId === projectId && !l.deleted && l.startedAt != null)
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
}
