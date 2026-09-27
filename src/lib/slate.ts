// Clapboard (slate) logic. Pure (no React), tested in tests/slate.test.ts.
import type { SlateRow } from "./sync/model.ts";

export type SlateField = "title" | "roll" | "scene" | "take" | "date" | "producer" | "director";

export const SLATE_LABELS: Record<SlateField, string> = {
  title: "Production",
  roll: "Roll",
  scene: "Scene",
  take: "Take",
  date: "Date",
  producer: "Producer",
  director: "Director",
};

export const SLATE_LIMITS: Record<SlateField, number> = {
  title: 40,
  roll: 8,
  scene: 8,
  take: 8,
  date: 20,
  producer: 30,
  director: 30,
};

export type SlateValues = Pick<SlateRow, SlateField>;

export const DEFAULT_SLATE: SlateValues = { title: "", roll: "1", scene: "1", take: "1", date: "", producer: "", director: "" };

/** Tidy a value typed into a slate field: single spaces, trimmed, within the field's limit. */
export function cleanSlateValue(field: SlateField, raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, SLATE_LIMITS[field]).trim();
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "SEP 27 2026" — how the date reads on the board when it's left as today. */
export function slateDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/**
 * Step a take up or down, keeping any letters: "3" → "4", "12A" → "13A", "T3" → "T4".
 * Never below 1; text without a number is left alone.
 */
export function stepTake(take: string, by: 1 | -1): string {
  const m = take.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return take || (by > 0 ? "1" : "");
  const [, pre, digits, post] = m;
  const n = Math.max(1, Number(digits) + by);
  return `${pre}${String(n).padStart(digits.length, "0")}${post}`;
}

/** What the board shows: saved values over the defaults; the title falls back to the project name. */
export function boardValues(row: Partial<SlateValues> | undefined, projectName: string, now: number): SlateValues {
  const v = { ...DEFAULT_SLATE, ...(row ?? {}) };
  return { ...v, title: v.title || projectName, date: v.date || slateDate(now) };
}
