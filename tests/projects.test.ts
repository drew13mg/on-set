import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, defaultProjectName, friendlyDate, sortProjects } from "../src/lib/projects.ts";

test("default project names count up", () => {
  assert.equal(defaultProjectName([]), "Untitled project");
  assert.equal(defaultProjectName([{ name: "Untitled project" }]), "Untitled project 2");
  assert.equal(defaultProjectName([{ name: "untitled project" }, { name: "Untitled project 2" }]), "Untitled project 3");
});

test("createProject trims and falls back", () => {
  const p = createProject("  Pistons Media Day  ", [], 1000);
  assert.equal(p.name, "Pistons Media Day");
  assert.equal(p.createdAt, 1000);
  assert.equal(p.updatedAt, 1000);
  assert.equal(createProject("  ", [p]).name, "Untitled project");
});

test("sorts most recently used first without mutating", () => {
  const a = { id: "a", name: "A", createdAt: 1, updatedAt: 5 };
  const b = { id: "b", name: "B", createdAt: 2, updatedAt: 9 };
  const list = [a, b];
  assert.deepEqual(sortProjects(list).map((p) => p.id), ["b", "a"]);
  assert.deepEqual(list.map((p) => p.id), ["a", "b"]);
});

test("friendly dates", () => {
  const now = new Date(2026, 8, 26, 22, 0).getTime();
  assert.equal(friendlyDate(new Date(2026, 8, 26, 8, 0).getTime(), now), "Today");
  assert.equal(friendlyDate(new Date(2026, 8, 25, 23, 0).getTime(), now), "Yesterday");
  assert.equal(friendlyDate(new Date(2026, 8, 12).getTime(), now), "Sep 12");
  assert.equal(friendlyDate(new Date(2025, 8, 12).getTime(), now), "Sep 12, 2025");
});
