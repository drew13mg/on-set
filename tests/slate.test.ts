import { test } from "node:test";
import assert from "node:assert/strict";
import { boardValues, cleanSlateValue, slateDate, stepTake } from "../src/lib/slate.ts";

test("takes step up and down, keeping letters and padding", () => {
  assert.equal(stepTake("3", 1), "4");
  assert.equal(stepTake("12A", 1), "13A");
  assert.equal(stepTake("T3", 1), "T4");
  assert.equal(stepTake("09", 1), "10");
  assert.equal(stepTake("001", 1), "002");
  assert.equal(stepTake("1", -1), "1");
  assert.equal(stepTake("5", -1), "4");
  assert.equal(stepTake("", 1), "1");
  assert.equal(stepTake("PU", 1), "PU");
});

test("values are tidied and capped", () => {
  assert.equal(cleanSlateValue("scene", "  12   B  "), "12 B");
  assert.equal(cleanSlateValue("roll", "A001-EXTRA-LONG"), "A001-EXT");
  assert.equal(cleanSlateValue("title", "x".repeat(60)).length, 40);
});

test("board falls back to the project name and today's date", () => {
  const now = new Date(2026, 8, 27, 10, 0).getTime();
  assert.equal(slateDate(now), "SEP 27 2026");
  const v = boardValues(undefined, "Pistons Media Day", now);
  assert.deepEqual(v, { title: "Pistons Media Day", roll: "1", scene: "1", take: "1", date: "SEP 27 2026", producer: "", director: "" });
  assert.equal(boardValues({ title: "Media Day", date: "OCT 1" }, "P", now).date, "OCT 1");
});
