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

export const MAX_TITLE = 30;

/** Tidy a shot title: single spaces, trimmed, at most 30 characters. */
export function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE).trim();
}

/** Action buttons at the bottom of a list. */
export const ACTION_STATUS = { done: "done", active: "active", uncheck: "none" } as const satisfies Record<string, ShotStatus>;

/** The project's active (started) list, if any. Only one list is active at a time. */
export function activeList(lists: ShotListRow[], projectId: string): ShotListRow | undefined {
  return lists
    .filter((l) => l.projectId === projectId && !l.deleted && l.startedAt != null)
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
}

export type TrackerShot = { number: number; title: string; at: number | null };
export type TrackerRow = {
  listId: string;
  listName: string;
  /** This is the project's started (active) list. */
  started: boolean;
  lastDone: TrackerShot | null;
  /** Active shots, most recently activated first. */
  active: TrackerShot[];
};

const toTracker = (s: ShotRow): TrackerShot => ({ number: s.number, title: s.description, at: s.statusAt ?? null });
// Most recent status change first; shots marked before status times existed fall back to their number.
const byRecent = (a: ShotRow, b: ShotRow) => (b.statusAt ?? 0) - (a.statusAt ?? 0) || b.number - a.number;

/**
 * Live tracker: for each shot list, the shot most recently marked Done and the
 * shot(s) currently Active. The started list comes first, then newest lists.
 */
export function trackerRows(lists: ShotListRow[], shots: ShotRow[], projectId: string): TrackerRow[] {
  const started = activeList(lists, projectId)?.id;
  return lists
    .filter((l) => l.projectId === projectId && !l.deleted)
    .sort((a, b) => Number(b.id === started) - Number(a.id === started) || b.createdAt - a.createdAt)
    .map((l) => {
      const live = liveShots(shots, l.id);
      const done = live.filter((s) => s.status === "done").sort(byRecent);
      const active = live.filter((s) => s.status === "active").sort(byRecent);
      return {
        listId: l.id,
        listName: l.name,
        started: l.id === started,
        lastDone: done[0] ? toTracker(done[0]) : null,
        active: active.map(toTracker),
      };
    });
}

/** "12 · Coach speech" or "Shot 12" when untitled. */
export const shotLabel = (s: TrackerShot) => (s.title ? `${s.number} · ${s.title}` : `Shot ${s.number}`);

// ============ Scheduled times ============

export const DAY_MIN = 24 * 60;

/**
 * Read a time of day typed on set: "9", "930", "0930", "14:15", "9.30", "9:30pm", "930p", "12am".
 * Returns minutes after midnight, or null if it can't be read.
 */
export function parseTimeOfDay(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d{1,4}|\d{1,2}[:.h]\d{2})(?:([ap])\.?(?:m\.?)?)?$/);
  if (!m) return null;
  const [, clock, meridiem] = m;
  let h: number;
  let min: number;
  const parts = clock.split(/[:.h]/);
  if (parts.length === 2) {
    h = Number(parts[0]);
    min = Number(parts[1]);
  } else if (clock.length <= 2) {
    h = Number(clock);
    min = 0;
  } else {
    h = Number(clock.slice(0, clock.length - 2));
    min = Number(clock.slice(-2));
  }
  if (min > 59) return null;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem === "p" ? 12 : 0);
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** 570 → "09:30" (24-hour, like every other time in the app). */
export function formatMinutes(min: number): string {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "12 min", "1 h", "1 h 05 min" */
export function formatDuration(min: number): string {
  const m = Math.round(Math.abs(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")} min` : `${h} h`;
}

/**
 * A sensible starting time when scheduling a shot: carry on the pace of the
 * previous two scheduled shots (or repeat the previous time). Null if none before it.
 */
export function suggestTime(shots: ShotRow[], number: number): number | null {
  const before = shots
    .filter((s) => !s.deleted && s.number < number && s.timeMin != null)
    .sort((a, b) => a.number - b.number);
  const b = before[before.length - 1];
  if (!b) return null;
  const a = before[before.length - 2];
  const gap = a ? (b.timeMin! - a.timeMin! + DAY_MIN) % DAY_MIN : 0;
  return (b.timeMin! + (gap > 0 && gap <= 180 ? gap : 0)) % DAY_MIN;
}

export type ScheduleItem = {
  id: string;
  number: number;
  title: string;
  status: ShotStatus;
  /** Scheduled start, in minutes from midnight of the list's first day (can pass 1440 on night shoots). */
  start: number;
  /** When the next scheduled shot starts (or an estimated length for the last one). */
  end: number;
  /** Where to draw it: shots scheduled at the same time share their slot. */
  x0: number;
  x1: number;
};

export type Schedule = {
  items: ScheduleItem[];
  /** Graph range, whole hours. */
  from: number;
  to: number;
  /** Shots without a time. */
  untimed: number;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * The list's schedule from the shots' times. Shots are read in number order, so a
 * time that jumps back by more than 6 hours is taken as past midnight (night shoots).
 */
export function buildSchedule(shots: ShotRow[]): Schedule | null {
  const live = shots.filter((s) => !s.deleted).sort((a, b) => a.number - b.number);
  const timed: { s: ShotRow; start: number }[] = [];
  let day = 0;
  let prev: number | null = null;
  for (const s of live) {
    if (s.timeMin == null) continue;
    let t = s.timeMin + day * DAY_MIN;
    if (prev != null && t < prev - 6 * 60) {
      day++;
      t += DAY_MIN;
    }
    prev = t;
    timed.push({ s, start: t });
  }
  if (!timed.length) return null;
  timed.sort((a, b) => a.start - b.start || a.s.number - b.s.number);

  const starts = [...new Set(timed.map((t) => t.start))];
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  const lastLen = Math.min(Math.max(median(gaps) ?? 15, 5), 60);

  const items: ScheduleItem[] = [];
  for (let i = 0; i < timed.length; ) {
    let j = i;
    while (j < timed.length && timed[j].start === timed[i].start) j++;
    const start = timed[i].start;
    const end = j < timed.length ? timed[j].start : start + lastLen;
    const k = j - i;
    for (let n = 0; n < k; n++) {
      const { s } = timed[i + n];
      items.push({
        id: s.id,
        number: s.number,
        title: s.description,
        status: s.status,
        start,
        end,
        x0: start + ((end - start) * n) / k,
        x1: start + ((end - start) * (n + 1)) / k,
      });
    }
    i = j;
  }
  const first = items[0].start;
  const last = Math.max(...items.map((it) => it.end));
  const from = Math.floor(first / 60) * 60;
  let to = Math.ceil(last / 60) * 60;
  if (to - from < 60) to = from + 60;
  return { items, from, to, untimed: live.length - items.length };
}

/** Today's clock time placed on the schedule (after midnight counts as the next day if the schedule runs that late). */
export function nowOnSchedule(schedule: Schedule, nowMin: number): number {
  return nowMin < schedule.from && nowMin + DAY_MIN <= schedule.to ? nowMin + DAY_MIN : nowMin;
}

export type Drift =
  | { kind: "behind" | "ahead" | "before"; minutes: number }
  | { kind: "on" | "wrapped"; minutes: 0 };

/**
 * How the shoot is tracking against the schedule, given where "now" sits on it:
 * - an Active shot is on time while now is inside its slot;
 * - otherwise the next shot not done is compared to its scheduled start.
 */
export function scheduleDrift(schedule: Schedule, now: number, tolerance = 5): Drift {
  const open = schedule.items.filter((i) => i.status !== "done");
  if (!open.length) return { kind: "wrapped", minutes: 0 };
  const current = open.find((i) => i.status === "active") ?? open[0];
  const started = schedule.items.some((i) => i.status !== "none");
  if (current.status === "active") {
    if (now > current.end + tolerance) return { kind: "behind", minutes: now - current.end };
    if (now < current.start - tolerance) return { kind: "ahead", minutes: current.start - now };
    return { kind: "on", minutes: 0 };
  }
  if (now > current.start + tolerance) return { kind: "behind", minutes: now - current.start };
  if (now < current.start - tolerance) return { kind: started ? "ahead" : "before", minutes: current.start - now };
  return { kind: "on", minutes: 0 };
}

export function driftLabel(d: Drift): string {
  switch (d.kind) {
    case "behind":
      return `${formatDuration(d.minutes)} behind`;
    case "ahead":
      return `${formatDuration(d.minutes)} ahead`;
    case "before":
      return `First shot in ${formatDuration(d.minutes)}`;
    case "on":
      return "On schedule";
    case "wrapped":
      return "All shots done";
  }
}
