import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastUrl, hasForecastFor, hourFor, lightQuality, parseForecast, weatherLabel } from "../src/lib/weather.ts";

const raw = {
  timezone: "America/Toronto",
  utc_offset_seconds: -14400,
  current: {
    time: "2026-09-26T22:15",
    temperature_2m: 14.6,
    apparent_temperature: 13.1,
    relative_humidity_2m: 71,
    precipitation: 0,
    weather_code: 2,
    cloud_cover: 40,
    wind_speed_10m: 12.4,
    wind_direction_10m: 250,
    wind_gusts_10m: 25.2,
    is_day: 0,
  },
  hourly: {
    time: ["2026-09-26T00:00", "2026-09-26T01:00", "2026-09-27T14:00"],
    temperature_2m: [12, 11.5, 19],
    precipitation_probability: [0, 5, 60],
    precipitation: [0, 0, 1.2],
    weather_code: [1, 2, 61],
    cloud_cover: [10, 30, 95],
    wind_speed_10m: [8, 9, 20],
    wind_direction_10m: [200, 210, 240],
    wind_gusts_10m: [15, 16, 38],
    visibility: [24000, 24000, null],
    uv_index: [0, 0, 2.1],
  },
};

test("builds the forecast URL with local time zone", () => {
  const u = forecastUrl(43.65321, -79.38318);
  assert.ok(u.startsWith("https://api.open-meteo.com/v1/forecast?"));
  assert.ok(u.includes("latitude=43.6532"));
  assert.ok(u.includes("timezone=auto"));
  assert.ok(u.includes("forecast_days=16"));
});

test("parses current and hourly weather", () => {
  const w = parseForecast(raw, 123);
  assert.equal(w.timeZone, "America/Toronto");
  assert.equal(w.fetchedAt, 123);
  assert.equal(w.current.temperature, 14.6);
  assert.equal(w.current.isDay, false);
  assert.equal(w.hourly.length, 3);
  assert.equal(w.hourly[2].visibility, null);
  assert.equal(w.hourly[2].precipProbability, 60);
});

test("finds the hour for a local date + slider hour", () => {
  const w = parseForecast(raw);
  assert.equal(hourFor(w, "2026-09-27", 14)?.code, 61);
  assert.equal(hourFor(w, "2026-09-26", 1)?.temperature, 11.5);
  assert.equal(hourFor(w, "2026-10-30", 12), null);
  assert.equal(hourFor(null, "2026-09-26", 1), null);
  assert.ok(hasForecastFor(w, "2026-09-27"));
  assert.ok(!hasForecastFor(w, "2026-10-30"));
});

test("labels", () => {
  assert.equal(weatherLabel(0), "Clear");
  assert.equal(weatherLabel(61), "Light rain");
  assert.equal(weatherLabel(1234), "—");
  assert.equal(lightQuality(5), "Hard sun");
  assert.equal(lightQuality(95), "Soft, overcast");
});
