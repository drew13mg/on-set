import { StyleSheet, Text, View } from "react-native";
import { compassPoint } from "@/lib/sun";
import { deg, lightQuality, weatherLabel, type CurrentWeather, type HourWeather } from "@/lib/weather";
import { fonts } from "@/lib/fonts";
import { colors, space, type } from "@/lib/theme";

/** Arrow pointing where the wind is blowing, with speed and gusts. */
export function Wind({ speed, gusts, direction }: { speed: number; gusts: number; direction: number }) {
  return (
    <View style={styles.windRow}>
      <Text style={[styles.arrow, { transform: [{ rotate: `${direction}deg` }] }]}>↓</Text>
      <Text style={type.time}>
        {Math.round(speed)} km/h from {compassPoint(direction)}
        <Text style={{ color: colors.muted }}>  gusts {Math.round(gusts)}</Text>
      </Text>
    </View>
  );
}

export function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.time, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

/** Live conditions at the location. */
export function CurrentConditions({ w }: { w: CurrentWeather }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.hero}>
        <Text style={styles.bigTemp}>{deg(w.temperature)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>{weatherLabel(w.code)}</Text>
          <Text style={type.small}>Feels like {deg(w.feelsLike)}</Text>
        </View>
      </View>
      <Wind speed={w.windSpeed} gusts={w.windGusts} direction={w.windDirection} />
      <View style={styles.grid}>
        <Stat label="Cloud" value={`${Math.round(w.cloudCover)}%`} />
        <Stat label="Humidity" value={`${Math.round(w.humidity)}%`} />
        <Stat label="Precip" value={`${w.precipitation.toFixed(1)} mm`} tint={w.precipitation > 0 ? colors.markOut : undefined} />
      </View>
    </View>
  );
}

/** Forecast for the slider's hour. */
export function HourForecast({ h }: { h: HourWeather }) {
  const rain = h.precipProbability;
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.hero}>
        <Text style={styles.midTemp}>{deg(h.temperature)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>{weatherLabel(h.code)}</Text>
          <Text style={type.small}>{lightQuality(h.cloudCover)} · {Math.round(h.cloudCover)}% cloud</Text>
        </View>
      </View>
      <Wind speed={h.windSpeed} gusts={h.windGusts} direction={h.windDirection} />
      <View style={styles.grid}>
        <Stat
          label="Rain chance"
          value={rain == null ? "—" : `${Math.round(rain)}%`}
          tint={rain != null && rain >= 40 ? colors.markOut : undefined}
        />
        <Stat label="Visibility" value={h.visibility == null ? "—" : `${(h.visibility / 1000).toFixed(h.visibility < 10000 ? 1 : 0)} km`} />
        <Stat label="UV" value={h.uvIndex == null ? "—" : h.uvIndex.toFixed(0)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  bigTemp: { fontFamily: fonts.bold, fontSize: 44, color: colors.text, fontVariant: ["tabular-nums"] },
  midTemp: { fontFamily: fonts.bold, fontSize: 34, color: colors.text, fontVariant: ["tabular-nums"] },
  windRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  arrow: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, width: 18, textAlign: "center" },
  grid: { flexDirection: "row", justifyContent: "space-between" },
  stat: { gap: 2, minWidth: 80 },
});
