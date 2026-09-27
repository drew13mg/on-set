// Time-zone helpers. Sun times must be shown in the *location's* local time
// (scouting Vancouver from Toronto should show Vancouver clock times), so every
// conversion here takes an explicit zone rather than using the phone's.

/** A named IANA zone ("America/Toronto") or a fixed offset from UTC in minutes. */
export type Zone = { kind: "iana"; name: string } | { kind: "fixed"; offsetMin: number };

export type DateKey = string; // "YYYY-MM-DD" in the zone's local calendar

const MIN = 60_000;
const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Minutes the zone is ahead of UTC at the given instant (e.g. -240 for Toronto in summer). */
export function offsetMinutes(instant: number, zone: Zone): number {
  if (zone.kind === "fixed") return zone.offsetMin;
  const parts: Record<string, number> = {};
  for (const p of formatterFor(zone.name).formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / MIN);
}

/** Wall-clock parts of an instant in the zone. */
export function localParts(instant: number, zone: Zone) {
  const d = new Date(instant + offsetMinutes(instant, zone) * MIN);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

export function dateKeyOf(instant: number, zone: Zone): DateKey {
  const p = localParts(instant, zone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The instant of a local wall-clock time (minutes after midnight) on a local date. */
export function instantAt(key: DateKey, minuteOfDay: number, zone: Zone): number {
  const [y, m, d] = key.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d) + minuteOfDay * MIN;
  // Two passes settle the offset correctly across DST changes.
  let guess = wall - offsetMinutes(wall, zone) * MIN;
  guess = wall - offsetMinutes(guess, zone) * MIN;
  return guess;
}

/** Local minutes after midnight for an instant (0–1439). */
export function minuteOfDay(instant: number, zone: Zone): number {
  const p = localParts(instant, zone);
  return p.hour * 60 + p.minute;
}

/** "14:05" in the zone. */
export function clockHM(instant: number, zone: Zone): string {
  const p = localParts(instant, zone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "14:05" from minutes after midnight. */
export function minutesToHM(min: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat, Sep 26" */
export function formatDateKey(key: DateKey): string {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${MONTHS[m - 1]} ${d}`;
}

/** Short label for a zone: "UTC−4" style, at the given instant. */
export function offsetLabel(instant: number, zone: Zone): string {
  const off = offsetMinutes(instant, zone);
  const sign = off < 0 ? "−" : "+";
  const a = Math.abs(off);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${pad(a % 60)}` : ""}`;
}

export function deviceZone(): Zone {
  try {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (name) return { kind: "iana", name };
  } catch {}
  return { kind: "fixed", offsetMin: -new Date().getTimezoneOffset() };
}

/** Rough zone from longitude, used only if nothing better is known (offline, typed address). */
export function zoneFromLongitude(lon: number): Zone {
  return { kind: "fixed", offsetMin: Math.round(lon / 15) * 60 };
}

/** Use the IANA zone if the platform understands it; otherwise fall back. */
export function safeZone(name: string | undefined, fallback: Zone): Zone {
  if (!name) return fallback;
  try {
    formatterFor(name);
    return { kind: "iana", name };
  } catch {
    return fallback;
  }
}
