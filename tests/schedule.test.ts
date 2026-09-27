import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSchedule,
  driftLabel,
  formatDuration,
  formatMinutes,
  nowOnSchedule,
  parseTimeOfDay,
  scheduleDrift,
  suggestTime,
} from "../src/lib/shots.ts";
import type { ShotRow } from "../src/lib/sync/model.ts";

const shot = (n: number, time: string | null, over: Partial<ShotRow> = {}): ShotRow => ({
  id: `s${n}`,
  projectId: "p",
  listId: "L",
  number: n,
  status: "none",
  description: "",
  timeMin: time == null ? null : parseTimeOfDay(time),
  createdAt: 1,
  updatedMs: 1,
  deleted: false,
  ...over,
});
const at = (t: string) => parseTimeOfDay(t)!;

test("reads times the way people type them", () => {
  const cases: [string, string | null][] = [
    ["9", "09:00"], ["09", "09:00"], ["930", "09:30"], ["0930", "09:30"], ["1415", "14:15"],
    ["14:15", "14:15"], ["9.30", "09:30"], ["9h30", "09:30"], [" 9:30 pm ", "21:30"], ["930p", "21:30"],
    ["12am", "00:00"], ["12pm", "12:00"], ["12:30 a.m.", "00:30"], ["0", "00:00"], ["23:59", "23:59"],
    ["24:00", null], ["9:75", null], ["13pm", null], ["noon", null], ["", null], ["12345", null],
  ];
  for (const [input, want] of cases) {
    const got = parseTimeOfDay(input);
    assert.equal(got == null ? null : formatMinutes(got), want, input);
  }
});

test("durations", () => {
  assert.equal(formatDuration(12), "12 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(65), "1 h 05 min");
  assert.equal(formatDuration(-20), "20 min");
});

test("suggested time keeps the pace of the previous shots", () => {
  const shots = [shot(1, "9:00"), shot(2, "9:20"), shot(3, null)];
  assert.equal(formatMinutes(suggestTime(shots, 3)!), "09:40");
  assert.equal(formatMinutes(suggestTime(shots, 2)!), "09:00");
  assert.equal(suggestTime(shots, 1), null);
});

test("schedule: slots run to the next shot, graph snaps to whole hours", () => {
  const s = buildSchedule([shot(1, "9:10"), shot(2, "9:30"), shot(3, null), shot(4, "10:15")])!;
  assert.equal(s.untimed, 1);
  assert.deepEqual(s.items.map((i) => [i.number, formatMinutes(i.start), formatMinutes(i.end)]), [
    [1, "09:10", "09:30"],
    [2, "09:30", "10:15"],
    [4, "10:15", "11:00"], // last shot gets a typical slot length
  ]);
  assert.equal(formatMinutes(s.from), "09:00");
  assert.equal(formatMinutes(s.to), "11:00");
  assert.equal(buildSchedule([shot(1, null)]), null);
});

test("schedule: shots at the same time share the slot", () => {
  const s = buildSchedule([shot(1, "9:00"), shot(2, "9:00"), shot(3, "9:30")])!;
  const [a, b] = s.items;
  assert.deepEqual([a.x0, a.x1, b.x0, b.x1], [at("9:00"), at("9:15"), at("9:15"), at("9:30")]);
});

test("schedule: night shoots run past midnight", () => {
  const s = buildSchedule([shot(1, "22:00"), shot(2, "23:30"), shot(3, "0:30"), shot(4, "1:15")])!;
  assert.deepEqual(s.items.map((i) => i.number), [1, 2, 3, 4]);
  assert.equal(s.items[2].start, at("0:30") + 24 * 60);
  assert.equal(nowOnSchedule(s, at("0:45")), at("0:45") + 24 * 60);
  assert.equal(nowOnSchedule(s, at("22:15")), at("22:15"));
});

test("ahead / behind", () => {
  const shots = [shot(1, "9:00"), shot(2, "9:30"), shot(3, "10:00")];
  const sched = (over: Record<number, Partial<ShotRow>>) =>
    buildSchedule(shots.map((s) => ({ ...s, ...over[s.number] })))!;

  // Nothing marked yet, before the first shot.
  assert.equal(driftLabel(scheduleDrift(sched({}), at("8:40"))), "First shot in 20 min");
  // Shot 1 not started 12 minutes after its time.
  assert.equal(driftLabel(scheduleDrift(sched({}), at("9:12"))), "12 min behind");
  // Shot 2 active inside its slot.
  const s2 = sched({ 1: { status: "done" }, 2: { status: "active" } });
  assert.equal(driftLabel(scheduleDrift(s2, at("9:45"))), "On schedule");
  // Shot 2 still active well after shot 3 was due.
  assert.equal(driftLabel(scheduleDrift(s2, at("10:20"))), "20 min behind");
  // Shots 1–2 done by 9:35; shot 3 isn't due till 10:00.
  assert.equal(driftLabel(scheduleDrift(sched({ 1: { status: "done" }, 2: { status: "done" } }), at("9:35"))), "25 min ahead");
  // Everything done.
  assert.equal(driftLabel(scheduleDrift(sched({ 1: { status: "done" }, 2: { status: "done" }, 3: { status: "done" } }), at("11:00"))), "All shots done");
});
