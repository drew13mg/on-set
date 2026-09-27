import { test } from "node:test";
import assert from "node:assert/strict";
import { createClip, type TranscriptLine } from "../src/lib/clips.ts";
import {
  createTranscription,
  defaultTranscriptionName,
  exportSubject,
  exportText,
  formatLongDate,
  recordedSpan,
  sortTranscriptions,
  wordCount,
} from "../src/lib/transcriptions.ts";

const at = (h: number, m: number, s: number) => new Date(2026, 8, 26, h, m, s).getTime();

test("default names and creation", () => {
  assert.equal(defaultTranscriptionName([]), "Transcription 1");
  assert.equal(defaultTranscriptionName([{ name: "Transcription 2" }]), "Transcription 3");
  const t = createTranscription("p1", "  Locker room ", [], 5);
  assert.equal(t.name, "Locker room");
  assert.equal(t.projectId, "p1");
  assert.deepEqual(t.lines, []);
  assert.equal(createTranscription("p1", " ", [t]).name, "Transcription 2");
});

test("sort, span and word count", () => {
  const a = { ...createTranscription("p", "A", [], 1), updatedAt: 10 };
  const b = { ...createTranscription("p", "B", [], 2), updatedAt: 20 };
  assert.deepEqual(sortTranscriptions([a, b]).map((t) => t.name), ["B", "A"]);
  assert.equal(recordedSpan(a), null);
  const lines: TranscriptLine[] = [
    { id: "1", text: "Quiet on set", at: at(10, 0, 0) },
    { id: "2", text: "  rolling ", at: at(10, 0, 5) },
  ];
  const withLines = { ...a, lines };
  assert.deepEqual(recordedSpan(withLines), { start: at(10, 0, 0), end: at(10, 0, 5) });
  assert.equal(wordCount(withLines), 4);
});

test("long date", () => {
  assert.equal(formatLongDate(at(9, 0, 0)), "Sat, Sep 26, 2026");
});

test("export text lists clips then the transcript with marks in place", () => {
  const t = {
    ...createTranscription("p1", "Locker room", [], at(9, 59, 0)),
    lines: [
      { id: "1", text: "Quiet on set please.", at: at(10, 0, 0) },
      { id: "2", text: "Coach, tell us about tonight.", at: at(10, 0, 20) },
      { id: "3", text: "We're ready.", at: at(10, 0, 40) },
    ],
  };
  const clipB = createClip({ projectId: "p1", transcriptionId: t.id, name: "Coach answer", inAt: at(10, 0, 30), outAt: at(10, 0, 45), lines: t.lines, existing: [] });
  const clipA = createClip({ projectId: "p1", transcriptionId: t.id, name: "Question", inAt: at(10, 0, 10), outAt: at(10, 0, 25), lines: t.lines, existing: [] });
  const other = createClip({ projectId: "p1", transcriptionId: "different", name: "Elsewhere", inAt: 1, outAt: 2, lines: [], existing: [] });

  const text = exportText("Pistons Media Day", t, [clipB, other, clipA]);
  assert.ok(text.startsWith("ON SET – TRANSCRIPT & CLIP LIST\nProject: Pistons Media Day\nTranscription: Locker room\n"));
  assert.ok(text.includes("Date: Sat, Sep 26, 2026"));
  assert.ok(text.includes("Recorded: 10:00:00 – 10:00:40"));
  assert.ok(text.includes("CLIPS (2)"));
  assert.ok(!text.includes("Elsewhere"));
  // Clips numbered by IN time
  assert.ok(text.indexOf("01  Question") < text.indexOf("02  Coach answer"));
  assert.ok(text.includes("    IN 10:00:10   OUT 10:00:25   (0:15)"));
  assert.ok(text.includes('"Coach, tell us about tonight."'));
  // Transcript order: line, IN 01, line, OUT 01, IN 02, line, OUT 02
  const body = text.slice(text.indexOf("FULL TRANSCRIPT"));
  const order = [
    "10:00:00  Quiet on set please.",
    ">> IN  01 Question",
    "10:00:20  Coach, tell us about tonight.",
    "<< OUT 01 Question",
    ">> IN  02 Coach answer",
    "10:00:40  We're ready.",
    "<< OUT 02 Coach answer",
  ].map((s) => body.indexOf(s));
  assert.ok(order.every((i) => i >= 0), `missing: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(text.endsWith("\n"));
  assert.equal(exportSubject("Pistons Media Day", t), "Pistons Media Day – Locker room – transcript & clips");
});

test("export with nothing yet", () => {
  const t = createTranscription("p1", "Empty", [], at(9, 0, 0));
  const text = exportText("P", t, []);
  assert.ok(text.includes("No clips marked."));
  assert.ok(text.includes("Nothing transcribed yet."));
  assert.ok(!text.includes("Recorded:"));
});
