import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_STATUS,
  cleanTitle,
  MAX_TITLE,
  activeList,
  defaultListName,
  duplicateName,
  listProgress,
  liveShots,
  MAX_SHOTS,
  nextShotNumber,
  progressLabel,
  shotLabel,
  trackerRows,
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

test("shot titles: up to 30 characters, tidy spacing", () => {
  assert.equal(MAX_TITLE, 30);
  assert.equal(cleanTitle("  Wide   of   the court  "), "Wide of the court");
  assert.equal(cleanTitle("Coach walks to locker room door, slow push in"), "Coach walks to locker room doo");
  assert.equal(cleanTitle("Coach walks to locker room door, slow push in").length, 30);
  assert.equal(cleanTitle("   "), "");
  assert.equal(cleanTitle("Line\nbreak"), "Line break");
});

test("live tracker: last done and active shots per list", () => {
  const lists = [list("a", "Day 1", 500, { createdAt: 1 }), list("b", "Day 2", null, { createdAt: 2 }), list("x", "Gone", null, { deleted: true })];
  const shots = [
    shot(1, { listId: "a", status: "done", statusAt: 100, description: "Wide" }),
    shot(2, { listId: "a", status: "done", statusAt: 300, description: "Coach speech" }), // most recently done
    shot(3, { listId: "a", status: "done", statusAt: 200, description: "Door" }),
    shot(4, { listId: "a", status: "active", statusAt: 310, description: "Cade CU" }),
    shot(5, { listId: "a", status: "active", statusAt: 400 }),
    shot(6, { listId: "a", status: "none", statusAt: 999 }),
    shot(7, { listId: "a", status: "done", statusAt: 999, deleted: true }),
    shot(1, { id: "b1", listId: "b", status: "none" }),
  ];
  const rows = trackerRows(lists, shots, "p");
  assert.deepEqual(rows.map((r) => r.listName), ["Day 1", "Day 2"]); // started list first, deleted hidden
  assert.equal(rows[0].started, true);
  assert.deepEqual(rows[0].lastDone, { number: 2, title: "Coach speech", at: 300 });
  assert.deepEqual(rows[0].active.map((a) => a.number), [5, 4]);
  assert.equal(rows[1].lastDone, null);
  assert.deepEqual(rows[1].active, []);
  assert.equal(shotLabel({ number: 2, title: "Coach speech", at: 1 }), "2 · Coach speech");
  assert.equal(shotLabel({ number: 5, title: "", at: 1 }), "Shot 5");
});
