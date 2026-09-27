import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_STATUS,
  activeList,
  defaultListName,
  duplicateName,
  listProgress,
  liveShots,
  MAX_SHOTS,
  nextShotNumber,
  progressLabel,
  shotsToAdd,
} from "../src/lib/shots.ts";
import type { ShotListRow, ShotRow } from "../src/lib/sync/model.ts";

const shot = (n: number, over: Partial<ShotRow> = {}): ShotRow => ({
  id: `s${n}`,
  projectId: "p",
  listId: "L",
  number: n,
  status: "none",
  description: "",
  createdAt: 1,
  updatedMs: 1,
  deleted: false,
  ...over,
});
const list = (id: string, name: string, startedAt: number | null = null, over: Partial<ShotListRow> = {}): ShotListRow => ({
  id,
  projectId: "p",
  name,
  startedAt,
  createdAt: 1,
  updatedMs: 1,
  deleted: false,
  ...over,
});

test("120 shots: 3 across, 40 down", () => {
  assert.equal(MAX_SHOTS, 120);
  const full = Array.from({ length: 118 }, (_, i) => shot(i + 1));
  assert.equal(shotsToAdd(full, "L", 1), 1);
  assert.equal(shotsToAdd(full, "L", 10), 2);
  assert.equal(shotsToAdd([...full, shot(119), shot(120)], "L", 5), 0);
  assert.equal(shotsToAdd([], "L", 2.7), 2);
  assert.equal(shotsToAdd([], "L", -3), 0);
});

test("numbers stay with their shots; new shots go after the highest", () => {
  const shots = [shot(1), shot(2, { deleted: true }), shot(3), shot(5, { listId: "other" })];
  assert.deepEqual(liveShots(shots, "L").map((s) => s.number), [1, 3]);
  assert.equal(nextShotNumber(shots, "L"), 4);
  assert.equal(nextShotNumber([], "L"), 1);
});

test("progress", () => {
  const shots = [shot(1, { status: "done" }), shot(2, { status: "done" }), shot(3, { status: "active" }), shot(4)];
  const p = listProgress(shots, "L");
  assert.deepEqual(p, { total: 4, done: 2, active: 1, open: 1 });
  assert.equal(progressLabel(p), "4 shots · 2 done · 1 active");
  assert.equal(progressLabel(listProgress([], "L")), "No shots yet");
});

test("action buttons map to statuses", () => {
  assert.equal(ACTION_STATUS.done, "done");
  assert.equal(ACTION_STATUS.active, "active");
  assert.equal(ACTION_STATUS.uncheck, "none");
});

test("duplicate and default names", () => {
  assert.equal(duplicateName("Day 1", [list("a", "Day 1")]), "Day 1 copy");
  assert.equal(duplicateName("Day 1", [list("a", "Day 1"), list("b", "day 1 copy")]), "Day 1 copy 2");
  assert.equal(defaultListName([]), "Shot list 1");
  assert.equal(defaultListName([list("a", "Shot list 2")]), "Shot list 3");
});

test("active list is the most recently started one", () => {
  const lists = [list("a", "A", 100), list("b", "B", 200), list("c", "C"), list("d", "D", 300, { deleted: true }), list("e", "E", 400, { projectId: "q" })];
  assert.equal(activeList(lists, "p")?.id, "b");
  assert.equal(activeList([list("c", "C")], "p"), undefined);
});
