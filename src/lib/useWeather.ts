import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { fetchWeather, type Weather } from "./weather.ts";

const REFRESH_MS = 10 * 60_000; // live weather refresh while the screen is open
const STALE_MS = 5 * 60_000; // refresh on return to the app if older than this

/** Weather for a location that keeps itself current while in use. */
export function useWeather(lat: number | null, lon: number | null) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef<Weather | null>(null);

  const load = useCallback(async () => {
    if (lat == null || lon == null) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    try {
      const w = await fetchWeather(lat, lon, ctrl.signal);
      if (ctrl.signal.aborted) return;
      latest.current = w;
      setWeather(w);
      setError(null);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError("Weather unavailable. Check your connection. Showing the last update.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    latest.current = null;
    setWeather(null);
    setError(null);
    load();
    const id = setInterval(load, REFRESH_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && (!latest.current || Date.now() - latest.current.fetchedAt > STALE_MS)) load();
    });
    return () => {
      clearInterval(id);
      sub.remove();
      abort.current?.abort();
    };
  }, [load]);

  return { weather, loading, error, refresh: load };
}
