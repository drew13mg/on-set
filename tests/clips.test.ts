import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatTimeOfDay,
  formatDuration,
  transcriptBetween,
  defaultClipName,
  createClip,
  clipsToText,
  type TranscriptLine,
} from "../src/lib/clips.ts";

const at = (h: number, m: number, s: number) => new Date(2026, 8, 26, h, m, s).getTime();

test("formats time of day in 24h with zero padding", () => {
  assert.equal(formatTimeOfDay(at(9, 5, 3)), "09:05:03");
  assert.equal(formatTimeOfDay(at(21, 45, 59)), "21:45:59");
});

test("formats durations", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(42_000), "0:42");
  assert.equal(formatDuration(65_000), "1:05");
  assert.equal(formatDuration(3_909_000), "1:05:09");
  assert.equal(formatDuration(-5000), "0:00");
});

const lines: TranscriptLine[] = [
  { id: "1", text: "before the take", at: at(10, 0, 0) },
  { id: "2", text: "rolling", at: at(10, 0, 10) },
  { id: "3", text: "and action", at: at(10, 0, 12) },
  { id: "4", text: "cut", at: at(10, 0, 31) }, // finalized 1s after OUT, inside grace
  { id: "5", text: "reset to one", at: at(10, 0, 40) },
];

test("transcriptBetween keeps lines between IN and OUT plus grace", () => {
  assert.equal(transcriptBetween(lines, at(10, 0, 5), at(10, 0, 30)), "rolling and action cut");
  assert.equal(transcriptBetween(lines, at(10, 0, 5), at(10, 0, 30), 0), "rolling and action");
});

test("defaultClipName counts up and skips used names", () => {
  assert.equal(defaultClipName([]), "Clip 1");
  assert.equal(defaultClipName([{ name: "Wide" }]), "Clip 2");
  assert.equal(defaultClipName([{ name: "x" }, { name: "Clip 3" }]), "Clip 4");
});

test("createClip trims name and falls back to default", () => {
  const c = createClip({ name: "  Scene 4 Take 2 ", inAt: at(10, 0, 5), outAt: at(10, 0, 30), lines, existing: [] });
  assert.equal(c.name, "Scene 4 Take 2");
  assert.equal(c.transcript, "rolling and action cut");
  const blank = createClip({ name: "   ", inAt: 1, outAt: 2, lines: [], existing: [c] });
  assert.equal(blank.name, "Clip 2");
});

test("clipsToText sorts by IN time", () => {
  const a = createClip({ name: "B", inAt: at(11, 0, 0), outAt: at(11, 0, 10), lines: [], existing: [] });
  const b = createClip({ name: "A", inAt: at(10, 0, 5), outAt: at(10, 0, 30), lines, existing: [] });
  const text = clipsToText([a, b]);
  assert.ok(text.startsWith("A  IN 10:00:05  OUT 10:00:30  (0:25)"));
  assert.ok(text.includes('"rolling and action cut"'));
  assert.ok(text.endsWith("B  IN 11:00:00  OUT 11:00:10  (0:10)"));
});
