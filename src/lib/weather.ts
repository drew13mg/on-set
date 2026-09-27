// Weather and place search via Open-Meteo (free, no API key).
// Hourly times come back in the location's own local time ("2026-09-26T14:00"),
// which lines up directly with the Sun Tracker's date + slider hour.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** Open-Meteo only forecasts this many days ahead. */
export const FORECAST_DAYS = 16;

export type CurrentWeather = {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  code: number;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  isDay: boolean;
};

export type HourWeather = {
  time: string; // local "YYYY-MM-DDTHH:00"
  temperature: number;
  precipProbability: number | null;
  precipitation: number;
  code: number;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  visibility: number | null; // metres
  uvIndex: number | null;
};

export type Weather = {
  timeZone: string;
  utcOffsetSeconds: number;
  current: CurrentWeather;
  hourly: HourWeather[];
  fetchedAt: number;
};

const CURRENT_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "is_day",
];
const HOURLY_VARS = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "visibility",
  "uv_index",
];

export function forecastUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: CURRENT_VARS.join(","),
    hourly: HOURLY_VARS.join(","),
    timezone: "auto",
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: "kmh",
  });
  return `${FORECAST_URL}?${q.toString()}`;
}

// Raw response shape (only the parts used here).
type Raw = {
  timezone: string;
  utc_offset_seconds: number;
  current: Record<string, number | string>;
  hourly: Record<string, (number | null)[]> & { time: string[] };
};

export function parseForecast(raw: Raw, now = Date.now()): Weather {
  const c = raw.current;
  const h = raw.hourly;
  const num = (v: unknown, fallback = 0) => (typeof v === "number" && !Number.isNaN(v) ? v : fallback);
  const at = (key: string, i: number) => {
    const v = h[key]?.[i];
    return typeof v === "number" ? v : null;
  };
  return {
    timeZone: raw.timezone,
    utcOffsetSeconds: raw.utc_offset_seconds,
    fetchedAt: now,
    current: {
      time: String(c.time),
      temperature: num(c.temperature_2m),
      feelsLike: num(c.apparent_temperature),
      humidity: num(c.relative_humidity_2m),
      precipitation: num(c.precipitation),
      code: num(c.weather_code),
      cloudCover: num(c.cloud_cover),
      windSpeed: num(c.wind_speed_10m),
      windDirection: num(c.wind_direction_10m),
      windGusts: num(c.wind_gusts_10m),
      isDay: num(c.is_day) === 1,
    },
    hourly: h.time.map((time, i) => ({
      time,
      temperature: at("temperature_2m", i) ?? 0,
      precipProbability: at("precipitation_probability", i),
      precipitation: at("precipitation", i) ?? 0,
      code: at("weather_code", i) ?? 0,
      cloudCover: at("cloud_cover", i) ?? 0,
      windSpeed: at("wind_speed_10m", i) ?? 0,
      windDirection: at("wind_direction_10m", i) ?? 0,
      windGusts: at("wind_gusts_10m", i) ?? 0,
      visibility: at("visibility", i),
      uvIndex: at("uv_index", i),
    })),
  };
}

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<Weather> {
  const res = await fetch(forecastUrl(lat, lon), { signal });
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
  return parseForecast((await res.json()) as Raw);
}

/** Forecast for a local date ("YYYY-MM-DD") and hour (0–23), if it's in range. */
export function hourFor(weather: Weather | null, dateKey: string, hour: number): HourWeather | null {
  if (!weather) return null;
  const key = `${dateKey}T${String(Math.max(0, Math.min(23, hour))).padStart(2, "0")}:00`;
  return weather.hourly.find((h) => h.time === key) ?? null;
}

/** Whether the date has any forecast data. */
export function hasForecastFor(weather: Weather | null, dateKey: string): boolean {
  return !!weather?.hourly.some((h) => h.time.startsWith(dateKey));
}

// WMO weather codes used by Open-Meteo.
const CODES: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm, hail",
  99: "Thunderstorm, hail",
};

export function weatherLabel(code: number): string {
  return CODES[code] ?? "—";
}

/** How the sky will affect the light, from cloud cover %. */
export function lightQuality(cloudCover: number): string {
  if (cloudCover < 15) return "Hard sun";
  if (cloudCover < 45) return "Mostly sun";
  if (cloudCover < 80) return "Mixed / broken cloud";
  return "Soft, overcast";
}

export type PlaceResult = {
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  timeZone?: string;
};

type RawPlace = {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  timezone?: string;
};

/** Search city / place names (works everywhere, including web). */
export async function searchPlaceNames(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = new URLSearchParams({ name: query.trim(), count: "6", language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${q.toString()}`, { signal });
  if (!res.ok) throw new Error(`Place search returned ${res.status}`);
  const data = (await res.json()) as { results?: RawPlace[] };
  return (data.results ?? []).map((p) => ({
    name: p.name,
    subtitle: [p.admin1, p.country].filter(Boolean).join(", "),
    lat: p.latitude,
    lon: p.longitude,
    timeZone: p.timezone,
  }));
}

/** "12°" style temperature. */
export const deg = (n: number) => `${Math.round(n)}°`;
