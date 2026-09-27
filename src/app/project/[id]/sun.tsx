import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateRow } from "@/components/DateRow";
import { PlacePicker } from "@/components/PlacePicker";
import { SunCompass } from "@/components/SunCompass";
import { TimeSlider } from "@/components/TimeSlider";
import { CurrentConditions, HourForecast, Stat } from "@/components/WeatherCards";
import type { Place } from "@/lib/location";
import {
  compassPoint,
  dayEvents,
  dayKind,
  dayPath,
  PHASE_LABEL,
  shadowBearing,
  shadowRatio,
  sunAt,
} from "@/lib/sun";
import {
  clockHM,
  dateKeyOf,
  deviceZone,
  instantAt,
  minuteOfDay,
  minutesToHM,
  offsetLabel,
  safeZone,
  zoneFromLongitude,
  type DateKey,
} from "@/lib/tz";
import { useNow } from "@/lib/useNow";
import { useCurrentProject } from "@/lib/projects-store";
import { useSync } from "@/lib/sync/SyncProvider";
import { useWeather } from "@/lib/useWeather";
import { hasForecastFor, hourFor, FORECAST_DAYS } from "@/lib/weather";
import { colors, phaseColors, radius, space, type } from "@/lib/theme";


export default function SunTracker() {
  const { width } = useWindowDimensions();
  const now = useNow(15_000);
  const { id: projectId, project } = useCurrentProject();
  const { engine } = useSync();

  // The location is saved on the project, so everyone on it sees the same place.
  const place: Place | null = project?.row.sunPlace ?? null;
  const restored = !!project;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<DateKey | null>(null); // null = today
  const [pickedMinute, setPickedMinute] = useState<number | null>(null); // null = follow "now" (today) / solar noon

  // First visit to a project with no location yet: ask for one.
  const asked = useRef(false);
  useEffect(() => {
    if (project && !project.row.sunPlace && !asked.current) {
      asked.current = true;
      setPickerOpen(true);
    }
  }, [project]);

  const choosePlace = (p: Place) => {
    engine.patch("projects", projectId, { sunPlace: p });
    setPickedDate(null);
    setPickedMinute(null);
    setPickerOpen(false);
  };

  const { weather, loading, error, refresh } = useWeather(place?.lat ?? null, place?.lon ?? null);

  // Always work in the location's own time zone.
  const zone = useMemo(() => {
    if (!place) return deviceZone();
    const fallback = place.source === "gps" ? deviceZone() : zoneFromLongitude(place.lon);
    return safeZone(weather?.timeZone ?? place.timeZone, fallback);
  }, [place, weather?.timeZone]);

  const today = dateKeyOf(now, zone);
  const dateKey = pickedDate ?? today;
  const isToday = dateKey === today;
  const nowMinute = isToday ? minuteOfDay(now, zone) : null;

  const lat = place?.lat ?? 0;
  const lon = place?.lon ?? 0;
  const path = useMemo(() => (place ? dayPath(dateKey, zone, lat, lon, 10) : []), [place, dateKey, zone, lat, lon]);
  const events = useMemo(() => (place ? dayEvents(dateKey, zone, lat, lon) : []), [place, dateKey, zone, lat, lon]);
  const kind = useMemo(() => (place ? dayKind(dateKey, zone, lat, lon) : "normal"), [place, dateKey, zone, lat, lon]);

  const noonMinute = useMemo(() => {
    const noon = events.find((e) => e.key === "solarNoon");
    return noon ? minuteOfDay(noon.at, zone) : 12 * 60;
  }, [events, zone]);

  const followingNow = pickedMinute === null && isToday;
  const minute = pickedMinute ?? nowMinute ?? noonMinute;
  const at = instantAt(dateKey, minute, zone);
  const sun = place ? sunAt(at, lat, lon) : { azimuth: 0, altitude: 0 };
  const phase = sun.altitude < -6 ? "night" : sun.altitude < -4 ? "blue" : sun.altitude < 6 ? "golden" : "day";
  const shadow = shadowRatio(sun.altitude);
  const hour = hourFor(weather, dateKey, Math.floor(minute / 60));

  const compassSize = Math.min(width - space.lg * 2, 360);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading && !!weather} onRefresh={refresh} tintColor={colors.muted} />
        }
      >
        {/* Location */}
        <Pressable onPress={() => setPickerOpen(true)} style={styles.placeRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.heading} numberOfLines={1}>
              {place ? place.name : "Choose a location"}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {place ? `${place.subtitle} · ${offsetLabel(at, zone)}` : "Current location or any address"}
            </Text>
          </View>
          <Text style={[type.label, { color: colors.text }]}>{place ? "Change" : "Choose"}</Text>
        </Pressable>

        {!place && restored ? (
          <View style={styles.card}>
            <Text style={type.body}>
              Pick a location to see where the sun will be through the day, plus live weather there.
            </Text>
            <Pressable onPress={() => setPickerOpen(true)} style={styles.primaryBtn}>
              <Text style={[type.button, { color: colors.bg }]}>Choose location</Text>
            </Pressable>
          </View>
        ) : null}

        {place ? (
          <>
            <DateRow
              value={dateKey}
              today={today}
              onChange={(k) => setPickedDate(k === today ? null : k)}
            />

            {/* Sky map */}
            <View style={styles.compassWrap}>
              <SunCompass size={compassSize} lat={lat} lon={lon} path={path} events={events} sun={sun} />
            </View>
            {kind !== "normal" ? (
              <Text style={[type.small, styles.center]}>
                {kind === "alwaysUp" ? "The sun doesn't set on this date." : "The sun doesn't rise on this date."}
              </Text>
            ) : null}

            {/* Time readout + slider */}
            <View style={styles.timeRow}>
              <Text style={type.timeLarge}>{minutesToHM(minute)}</Text>
              <View style={[styles.phasePill, { backgroundColor: phaseColors[phase] }]}>
                <Text style={[type.label, { color: phase === "night" || phase === "blue" ? colors.text : colors.bg }]}>
                  {PHASE_LABEL[phase]}
                </Text>
              </View>
              {followingNow ? (
                <View style={styles.liveTag}>
                  <View style={styles.liveDot} />
                  <Text style={type.label}>Now</Text>
                </View>
              ) : null}
            </View>

            <TimeSlider
              value={minute}
              onChange={setPickedMinute}
              path={path}
              events={events}
              zone={zone}
              nowMinute={nowMinute}
            />

            {/* Key moments: tap to jump */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {isToday ? (
                <Pressable onPress={() => setPickedMinute(null)} style={[styles.chip, followingNow && styles.chipOn]}>
                  <View style={[styles.chipDot, { backgroundColor: colors.record }]} />
                  <Text style={[type.small, { color: colors.text }]}>Now</Text>
                </Pressable>
              ) : null}
              {events.map((e) => {
                const m = minuteOfDay(e.at, zone);
                return (
                  <Pressable
                    key={e.key}
                    onPress={() => setPickedMinute(m)}
                    style={[styles.chip, pickedMinute === m && styles.chipOn]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: phaseColors[e.phase] }]} />
                    <Text style={[type.small, { color: colors.text }]}>{e.label}</Text>
                    <Text style={[type.small, styles.tab]}>{clockHM(e.at, zone)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Sun at the chosen time */}
            <View style={styles.card}>
              <Text style={type.label}>Sun at {minutesToHM(minute)}</Text>
              <View style={styles.grid}>
                <Stat label="Direction" value={`${Math.round(sun.azimuth)}° ${compassPoint(sun.azimuth)}`} />
                <Stat
                  label="Elevation"
                  value={`${sun.altitude.toFixed(1)}°`}
                  tint={sun.altitude < 0 ? colors.muted : undefined}
                />
                <Stat
                  label="Shadows"
                  value={shadow == null ? "None" : `${shadow > 20 ? ">20" : shadow.toFixed(1)}× ${compassPoint(shadowBearing(sun.azimuth))}`}
                />
              </View>
              <Text style={type.small}>
                {sun.altitude < 0
                  ? "Sun is below the horizon."
                  : `A 2 m stand casts a ${shadow! > 20 ? "very long" : `${(2 * shadow!).toFixed(1)} m`} shadow toward ${compassPoint(shadowBearing(sun.azimuth))}.`}
              </Text>
            </View>

            {/* Forecast at the chosen time */}
            <View style={styles.card}>
              <Text style={type.label}>Forecast at {minutesToHM(Math.floor(minute / 60) * 60)}</Text>
              {hour ? (
                <HourForecast h={hour} />
              ) : (
                <Text style={type.small}>
                  {!weather
                    ? loading
                      ? "Loading forecast…"
                      : "Forecast unavailable offline."
                    : hasForecastFor(weather, dateKey)
                      ? "No forecast for this hour."
                      : `Forecasts reach ${FORECAST_DAYS} days ahead. Sun positions work for any date.`}
                </Text>
              )}
            </View>

            {/* Live weather */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.liveTag}>
                  <View style={styles.liveDot} />
                  <Text style={type.label}>Live weather</Text>
                </View>
                {weather ? (
                  <Text style={type.small}>Updated {clockHM(weather.fetchedAt, zone)}</Text>
                ) : null}
              </View>
              {weather ? <CurrentConditions w={weather.current} /> : null}
              {!weather && loading ? <Text style={type.small}>Loading weather…</Text> : null}
              {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}
              <Text style={[type.small, styles.footnote]}>
                Refreshes every 10 minutes. Pull down to refresh now.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <PlacePicker
        visible={pickerOpen}
        onPick={choosePlace}
        onClose={() => setPickerOpen(false)}
        canClose
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  placeRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  center: { textAlign: "center" },
  compassWrap: { alignItems: "center" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  phasePill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  liveTag: { flexDirection: "row", alignItems: "center", gap: space.xs + 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.record },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  chipOn: { borderColor: colors.text },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  tab: { fontVariant: ["tabular-nums"] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  grid: { flexDirection: "row", justifyContent: "space-between" },
  primaryBtn: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: { color: colors.faint },
});
