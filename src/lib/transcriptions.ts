// Transcriptions: named groups inside a project, each with its own transcript and clip list.
// Pure logic (no React), tested in tests/transcriptions.test.ts.
import { formatDuration, formatTimeOfDay, makeId, type Clip, type TranscriptLine } from "./clips.ts";

export type Transcription = {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lines: TranscriptLine[];
};

/** "Transcription 1", "Transcription 2", ... skipping names already used in the project. */
export function defaultTranscriptionName(existing: Pick<Transcription, "name">[]): string {
  const used = new Set(existing.map((t) => t.name.trim().toLowerCase()));
  let n = existing.length + 1;
  while (used.has(`transcription ${n}`)) n++;
  return `Transcription ${n}`;
}

export function createTranscription(
  projectId: string,
  name: string,
  existing: Transcription[],
  now = Date.now(),
): Transcription {
  return {
    id: makeId(),
    projectId,
    name: name.trim() || defaultTranscriptionName(existing),
    createdAt: now,
    updatedAt: now,
    lines: [],
  };
}

export function sortTranscriptions(list: Transcription[]): Transcription[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** First → last line time, or null if nothing has been transcribed. */
export function recordedSpan(t: Transcription): { start: number; end: number } | null {
  if (!t.lines.length) return null;
  return { start: t.lines[0].at, end: t.lines[t.lines.length - 1].at };
}

export function wordCount(t: Transcription): number {
  return t.lines.reduce((n, l) => n + (l.text.trim() ? l.text.trim().split(/\s+/).length : 0), 0);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat, Sep 26, 2026" on the device calendar. */
export function formatLongDate(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const RULE = "-".repeat(48);
const num = (i: number) => String(i + 1).padStart(2, "0");

/** Email subject for a transcription export. */
export function exportSubject(projectName: string, t: Transcription): string {
  return `${projectName} – ${t.name} – transcript & clips`;
}

/**
 * Plain-text export for editors: header, numbered clip list with IN/OUT
 * (time of day) and dialogue, then the full timestamped transcript with the
 * IN/OUT marks placed where they happened.
 */
export function exportText(projectName: string, t: Transcription, allClips: Clip[]): string {
  const clips = allClips.filter((c) => c.transcriptionId === t.id).sort((a, b) => a.inAt - b.inAt);
  const span = recordedSpan(t);
  const out: string[] = [];

  out.push("ON SET – TRANSCRIPT & CLIP LIST");
  out.push(`Project: ${projectName}`);
  out.push(`Transcription: ${t.name}`);
  out.push(`Date: ${formatLongDate(span?.start ?? t.createdAt)}`);
  if (span) out.push(`Recorded: ${formatTimeOfDay(span.start)} – ${formatTimeOfDay(span.end)}`);
  out.push("Times are time of day (device clock), 24-hour.");
  out.push("");

  out.push(`CLIPS (${clips.length})`);
  out.push(RULE);
  if (!clips.length) out.push("No clips marked.");
  clips.forEach((c, i) => {
    out.push(`${num(i)}  ${c.name}`);
    out.push(`    IN ${formatTimeOfDay(c.inAt)}   OUT ${formatTimeOfDay(c.outAt)}   (${formatDuration(c.outAt - c.inAt)})`);
    if (c.transcript) out.push(`    "${c.transcript}"`);
    out.push("");
  });
  if (!clips.length) out.push("");

  out.push("FULL TRANSCRIPT");
  out.push(RULE);
  if (!t.lines.length) out.push("Nothing transcribed yet.");

  // Merge lines and marks in time order. Marks sort before a line at the same instant.
  type Row = { at: number; order: number; text: string };
  const rows: Row[] = t.lines.map((l) => ({ at: l.at, order: 1, text: `${formatTimeOfDay(l.at)}  ${l.text}` }));
  clips.forEach((c, i) => {
    rows.push({ at: c.inAt, order: 0, text: `          >> IN  ${num(i)} ${c.name}  (${formatTimeOfDay(c.inAt)})` });
    rows.push({ at: c.outAt, order: 0, text: `          << OUT ${num(i)} ${c.name}  (${formatTimeOfDay(c.outAt)})` });
  });
  rows.sort((a, b) => a.at - b.at || a.order - b.order);
  for (const r of rows) out.push(r.text);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
