import { memo, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { SunEvent, SunSample } from "@/lib/sun";
import { minuteOfDay, type Zone } from "@/lib/tz";
import { colors, phaseColors, radius, space, type } from "@/lib/theme";

type Props = {
  /** Minutes after local midnight, 0–1439. */
  value: number;
  onChange: (minute: number) => void;
  path: SunSample[];
  events: SunEvent[];
  zone: Zone;
  /** Minute of "now" when the chosen date is today. */
  nowMinute?: number | null;
};

const TRACK_H = 34;
const THUMB_W = 6;

/** Time-of-day slider whose track shows the day's light: night, blue hour, golden hour, daylight. */
function TimeSliderBase({ value, onChange, path, events, zone, nowMinute }: Props) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setFromX = (x: number) => {
    const w = widthRef.current;
    if (!w) return;
    const m = Math.round((Math.max(0, Math.min(w, x)) / w) * 1439);
    onChangeRef.current(m);
  };

  const pan = useMemo(() => {
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX = e.nativeEvent.locationX;
        setFromX(startX);
      },
      onPanResponderMove: (_e, g) => setFromX(startX + g.dx),
    });
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const x = (min: number) => (min / 1440) * width;
  const ticks = events.filter((e) => e.key === "sunrise" || e.key === "sunset" || e.key === "solarNoon");

  return (
    <View>
      <View
        style={styles.track}
        onLayout={onLayout}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Time of day"
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          onChange(Math.max(0, Math.min(1439, value + (e.nativeEvent.actionName === "increment" ? 15 : -15))))
        }
      >
        {width > 0 ? (
          <Svg width={width} height={TRACK_H} pointerEvents="none">
            {path.slice(0, -1).map((s, i) => (
              <Rect
                key={i}
                x={x(s.minute)}
                y={0}
                width={x(path[i + 1].minute) - x(s.minute) + 0.5}
                height={TRACK_H}
                fill={phaseColors[s.phase]}
              />
            ))}
            {ticks.map((e) => (
              <Rect
                key={e.key}
                x={x(minuteOfDay(e.at, zone)) - 0.75}
                y={TRACK_H - 8}
                width={1.5}
                height={8}
                fill={colors.bg}
                opacity={0.7}
              />
            ))}
            {nowMinute != null ? (
              <Rect x={x(nowMinute) - 1} y={0} width={2} height={TRACK_H} fill={colors.record} />
            ) : null}
          </Svg>
        ) : null}
        {width > 0 ? (
          <View pointerEvents="none" style={[styles.thumb, { left: x(value) - THUMB_W / 2 - 3 }]}>
            <View style={styles.thumbInner} />
          </View>
        ) : null}
      </View>
      <View style={styles.hours}>
        {["00", "06", "12", "18", "24"].map((h) => (
          <Text key={h} style={[type.small, styles.hour]}>
            {h}
          </Text>
        ))}
      </View>
    </View>
  );
}

export const TimeSlider = memo(TimeSliderBase);

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: radius.sm,
    overflow: "visible",
    backgroundColor: colors.surface,
  },
  thumb: {
    position: "absolute",
    top: -6,
    bottom: -6,
    width: THUMB_W + 6,
    borderRadius: 4,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInner: { width: THUMB_W, height: "100%", borderRadius: 3, backgroundColor: colors.text },
  hours: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
  hour: { fontSize: 11, color: colors.faint, fontVariant: ["tabular-nums"] },
});
