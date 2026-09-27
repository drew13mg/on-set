// Sun position and key times for the Sun Tracker. Pure logic (no React), tested in tests/sun.test.ts.
import * as SunCalc from "suncalc";
import { instantAt, type DateKey, type Zone } from "./tz.ts";

// Light phases, following the common photography convention:
//   Night        sun below −6°
//   Blue hour    −6° to −4°
//   Golden hour  −4° to +6°
//   Day          above +6°
export type Phase = "night" | "blue" | "golden" | "day";

export function phaseFor(altitude: number): Phase {
  if (altitude < -6) return "night";
  if (altitude < -4) return "blue";
  if (altitude < 6) return "golden";
  return "day";
}

export const PHASE_LABEL: Record<Phase, string> = {
  night: "Night",
  blue: "Blue hour",
  golden: "Golden hour",
  day: "Daylight",
};

// suncalc already knows −6° (dawn/dusk) and +6° (golden hour). Add −4° for the blue/golden boundary.
let configured = false;
function configure() {
  if (configured) return;
  SunCalc.addTime(-4, "blueHourEnd", "blueHourStart");
  configured = true;
}

export type SunPosition = { azimuth: number; altitude: number };

/** Sun direction (degrees clockwise from true north) and height above the horizon (degrees). */
export function sunAt(instant: number, lat: number, lon: number): SunPosition {
  const p = SunCalc.getPosition(new Date(instant), lat, lon);
  return { azimuth: (p.azimuth + 360) % 360, altitude: p.altitude };
}

export type SunSample = SunPosition & { minute: number; at: number; phase: Phase };

/** Sun position every `stepMin` minutes across the local day (inclusive of 24:00). */
export function dayPath(key: DateKey, zone: Zone, lat: number, lon: number, stepMin = 10): SunSample[] {
  const out: SunSample[] = [];
  for (let minute = 0; minute <= 1440; minute += stepMin) {
    const at = instantAt(key, minute, zone);
    const pos = sunAt(at, lat, lon);
    out.push({ ...pos, minute, at, phase: phaseFor(pos.altitude) });
  }
  return out;
}

export type SunEvent = {
  key: string;
  label: string;
  at: number;
  /** Phase that begins at this moment (used for chip colour). */
  phase: Phase | "noon";
};

/** The day's key sun moments in time order, limited to the local calendar day. */
export function dayEvents(key: DateKey, zone: Zone, lat: number, lon: number): SunEvent[] {
  configure();
  const start = instantAt(key, 0, zone);
  const end = instantAt(key, 1440, zone);
  const noonRef = instantAt(key, 12 * 60, zone);
  const t = SunCalc.getTimes(new Date(noonRef), lat, lon);

  const pick = (name: string): number | null => {
    const v = t[name];
    return v instanceof Date && !Number.isNaN(v.getTime()) ? v.getTime() : null;
  };

  const rows: [string, string, Phase | "noon"][] = [
    ["dawn", "Blue hour", "blue"],
    ["blueHourEnd", "Golden hour", "golden"],
    ["sunrise", "Sunrise", "golden"],
    ["goldenHourEnd", "Golden ends", "day"],
    ["solarNoon", "Solar noon", "noon"],
    ["goldenHour", "Golden hour", "golden"],
    ["sunset", "Sunset", "golden"],
    ["blueHourStart", "Blue hour", "blue"],
    ["dusk", "Dark", "night"],
  ];

  return rows
    .map(([k, label, phase]) => ({ key: k, label, phase, at: pick(k) }))
    .filter((e): e is SunEvent => e.at !== null && e.at >= start && e.at < end)
    .sort((a, b) => a.at - b.at);
}

/** Polar day / polar night flags for the date. */
export function dayKind(key: DateKey, zone: Zone, lat: number, lon: number): "normal" | "alwaysUp" | "alwaysDown" {
  const t = SunCalc.getTimes(new Date(instantAt(key, 12 * 60, zone)), lat, lon);
  if (t.alwaysUp) return "alwaysUp";
  if (t.alwaysDown) return "alwaysDown";
  return "normal";
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** 16-point compass name for a bearing: 245 → "WSW". */
export function compassPoint(bearing: number): string {
  const b = ((bearing % 360) + 360) % 360;
  return POINTS[Math.round(b / 22.5) % 16];
}

/**
 * Shadow length as a multiple of the object's height (a 2 m stand casts a
 * 2 × ratio metre shadow). Null when the sun is at or below the horizon.
 */
export function shadowRatio(altitude: number): number | null {
  if (altitude <= 0.5) return null;
  return 1 / Math.tan((altitude * Math.PI) / 180);
}

/** Direction shadows point (opposite the sun). */
export function shadowBearing(azimuth: number): number {
  return (azimuth + 180) % 360;
}
