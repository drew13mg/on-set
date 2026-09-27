// Pure logic for ON SET's transcription marks. No React / native imports here,
// so it can be unit tested with plain Node (see tests/clips.test.ts).

/** A finalized line of transcript, stamped with the time of day it was heard. */
export type TranscriptLine = {
  id: string;
  text: string;
  /** Epoch ms when the recognizer finalized this line. */
  at: number;
};

/** A named IN/OUT pair captured while transcribing. */
export type Clip = {
  id: string;
  /** Project this clip belongs to. */
  projectId: string;
  /** Transcription (named group) this clip was marked in. */
  transcriptionId?: string;
  name: string;
  /** Epoch ms of the Mark In press (time of day). */
  inAt: number;
  /** Epoch ms of the Mark Out press (time of day). */
  outAt: number;
  /** Transcript heard between IN and OUT. */
  transcript: string;
  createdAt: number;
};

/**
 * Final transcript lines arrive a moment after the words are spoken, so lines
 * finalized shortly after Mark Out still belong to the clip.
 */
export const FINALIZE_GRACE_MS = 2500;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Time of day on the device clock, 24-hour: "14:03:27". */
export function formatTimeOfDay(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Clip length as "0:42" or "1:05:09". Never negative. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Transcript text finalized between Mark In and Mark Out (plus the grace window). */
export function transcriptBetween(
  lines: TranscriptLine[],
  inAt: number,
  outAt: number,
  graceMs: number = FINALIZE_GRACE_MS,
): string {
  return lines
    .filter((l) => l.at >= inAt && l.at <= outAt + graceMs)
    .map((l) => l.text.trim())
    .filter(Boolean)
    .join(" ");
}

/** Suggested name for the next clip: "Clip 1", "Clip 2", ... skipping names already used. */
export function defaultClipName(existing: Pick<Clip, "name">[]): string {
  const used = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  let n = existing.length + 1;
  while (used.has(`clip ${n}`)) n++;
  return `Clip ${n}`;
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a clip, falling back to the default name if the user left it blank. */
export function createClip(args: {
  projectId: string;
  transcriptionId?: string;
  name: string;
  inAt: number;
  outAt: number;
  lines: TranscriptLine[];
  /** Clips already in the same project (for the default name). */
  existing: Clip[];
  now?: number;
}): Clip {
  const name = args.name.trim() || defaultClipName(args.existing);
  return {
    id: makeId(),
    projectId: args.projectId,
    ...(args.transcriptionId ? { transcriptionId: args.transcriptionId } : {}),
    name,
    inAt: args.inAt,
    outAt: args.outAt,
    transcript: transcriptBetween(args.lines, args.inAt, args.outAt),
    createdAt: args.now ?? Date.now(),
  };
}

/** Plain-text log of clips, for sharing with editors / script supervisors. */
export function clipsToText(clips: Clip[]): string {
  return [...clips]
    .sort((a, b) => a.inAt - b.inAt)
    .map((c) => {
      const header = `${c.name}  IN ${formatTimeOfDay(c.inAt)}  OUT ${formatTimeOfDay(c.outAt)}  (${formatDuration(c.outAt - c.inAt)})`;
      return c.transcript ? `${header}\n  "${c.transcript}"` : header;
    })
    .join("\n\n");
}
