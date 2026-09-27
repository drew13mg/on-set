import { Platform } from "react-native";
import * as Location from "expo-location";
import { searchPlaceNames, type PlaceResult } from "./weather.ts";

export type Place = {
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  /** IANA zone if known up front (place search provides it; weather fills it in otherwise). */
  timeZone?: string;
  source: "gps" | "search";
};

function describe(a: Location.LocationGeocodedAddress | undefined, fallback: string) {
  if (!a) return { name: fallback, subtitle: "" };
  const street = [a.streetNumber, a.street].filter(Boolean).join(" ");
  const name = street || a.name || a.city || fallback;
  const subtitle = [street ? a.city : null, a.region, a.country].filter(Boolean).join(", ");
  return { name, subtitle };
}

const coords = (lat: number, lon: number) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

async function reverse(lat: number, lon: number) {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return a;
  } catch {
    return undefined;
  }
}

export class LocationDeniedError extends Error {}

/** The phone's current position, named by reverse geocoding when possible. */
export async function currentPlace(): Promise<Place> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new LocationDeniedError("Location access is off for ON SET.");
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 1000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude: lat, longitude: lon } = pos.coords;
  const { name, subtitle } = describe(await reverse(lat, lon), "Current location");
  return { name, subtitle: subtitle || coords(lat, lon), lat, lon, source: "gps" };
}

/**
 * Find places for a typed address or place name.
 * Street addresses use the phone's geocoder (iOS / Android); place names also use
 * Open-Meteo's search, which works everywhere and includes the time zone.
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const results: Place[] = [];

  if (Platform.OS !== "web") {
    try {
      const hits = await Location.geocodeAsync(q);
      for (const h of hits.slice(0, 3)) {
        const { name, subtitle } = describe(await reverse(h.latitude, h.longitude), q);
        results.push({ name, subtitle: subtitle || coords(h.latitude, h.longitude), lat: h.latitude, lon: h.longitude, source: "search" });
      }
    } catch {
      // fall through to name search
    }
  }

  try {
    const named: PlaceResult[] = await searchPlaceNames(q);
    for (const p of named) {
      const dup = results.some((r) => Math.abs(r.lat - p.lat) < 0.01 && Math.abs(r.lon - p.lon) < 0.01);
      if (!dup) results.push({ ...p, source: "search" });
    }
  } catch (e) {
    if (!results.length) throw e;
  }
  return results;
}
