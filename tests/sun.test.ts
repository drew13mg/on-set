import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, clockHM, dateKeyOf, instantAt, minuteOfDay, offsetMinutes, formatDateKey, type Zone } from "../src/lib/tz.ts";
import { compassPoint, dayEvents, dayKind, dayPath, phaseFor, shadowRatio, sunAt } from "../src/lib/sun.ts";

const TORONTO: Zone = { kind: "iana", name: "America/Toronto" };
const SYDNEY: Zone = { kind: "iana", name: "Australia/Sydney" };
const YYZ = { lat: 43.6532, lon: -79.3832 };

const minutesOf = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
const near = (actual: string, expected: string, tol = 3) =>
  assert.ok(Math.abs(minutesOf(actual) - minutesOf(expected)) <= tol, `${actual} vs ${expected}`);

test("zone offsets follow DST", () => {
  assert.equal(offsetMinutes(Date.UTC(2026, 6, 1, 12), TORONTO), -240);
  assert.equal(offsetMinutes(Date.UTC(2026, 0, 15, 12), TORONTO), -300);
  assert.equal(offsetMinutes(Date.UTC(2026, 0, 15, 12), SYDNEY), 660);
  assert.equal(offsetMinutes(0, { kind: "fixed", offsetMin: 330 }), 330);
});

test("local midnight and wall-clock round trip, incl. DST change day", () => {
  const m = instantAt("2026-09-26", 0, TORONTO);
  assert.equal(m, Date.UTC(2026, 8, 26, 4));
  assert.equal(dateKeyOf(m, TORONTO), "2026-09-26");
  // Nov 1 2026: clocks fall back in Toronto. 14:30 local = 19:30 UTC.
  const t = instantAt("2026-11-01", 14 * 60 + 30, TORONTO);
  assert.equal(t, Date.UTC(2026, 10, 1, 19, 30));
  assert.equal(clockHM(t, TORONTO), "14:30");
  assert.equal(minuteOfDay(t, TORONTO), 870);
});

test("date helpers", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(formatDateKey("2026-09-26"), "Sat, Sep 26");
});

test("Toronto summer solstice times match published almanac (±3 min)", () => {
  const ev = dayEvents("2026-06-21", TORONTO, YYZ.lat, YYZ.lon);
  const get = (k: string) => clockHM(ev.find((e) => e.key === k)!.at, TORONTO);
  near(get("sunrise"), "05:36");
  near(get("sunset"), "21:03");
  near(get("solarNoon"), "13:19");
  // Events are sorted and within the day
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].at >= ev[i - 1].at);
  assert.equal(ev[0].key, "dawn");
  assert.equal(ev[ev.length - 1].key, "dusk");
});

test("sun position at Toronto solar noon on the solstice", () => {
  const noon = dayEvents("2026-06-21", TORONTO, YYZ.lat, YYZ.lon).find((e) => e.key === "solarNoon")!;
  const p = sunAt(noon.at, YYZ.lat, YYZ.lon);
  assert.ok(Math.abs(p.altitude - 69.8) < 0.5, `altitude ${p.altitude}`);
  assert.ok(Math.abs(p.azimuth - 180) < 1, `azimuth ${p.azimuth}`);
});

test("day path covers the day and marks phases", () => {
  const path = dayPath("2026-09-26", TORONTO, YYZ.lat, YYZ.lon, 10);
  assert.equal(path.length, 145);
  assert.equal(path[0].phase, "night");
  assert.ok(path.some((s) => s.phase === "day"));
  assert.ok(path.some((s) => s.phase === "golden"));
});

test("polar night in Tromsø in December", () => {
  assert.equal(dayKind("2026-12-21", { kind: "iana", name: "Europe/Oslo" }, 69.65, 18.96), "alwaysDown");
});

test("helpers", () => {
  assert.equal(phaseFor(-10), "night");
  assert.equal(phaseFor(-5), "blue");
  assert.equal(phaseFor(2), "golden");
  assert.equal(phaseFor(30), "day");
  assert.equal(compassPoint(0), "N");
  assert.equal(compassPoint(245), "WSW");
  assert.equal(compassPoint(359), "N");
  assert.ok(Math.abs(shadowRatio(45)! - 1) < 1e-9);
  assert.equal(shadowRatio(-2), null);
});
