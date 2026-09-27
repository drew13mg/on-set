import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { driftLabel, formatMinutes, nowOnSchedule, scheduleDrift, type Schedule } from "@/lib/shots";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

const BAR_TOP = 10;
const BAR_H = 30;
const AXIS_H = 16;
const HEIGHT = BAR_TOP + BAR_H + AXIS_H;
const OPEN = "#46505D";

const fill = (status: string) => (status === "done" ? colors.record : status === "active" ? colors.markIn : OPEN);

type Props = {
  schedule: Schedule | null;
  /** Minutes after midnight right now. */
  nowMin: number;
  /** The list has been started: show how it's tracking against the schedule. */
  live: boolean;
  selectedId: string | null;
  onSelect: (shotId: string) => void;
  hasShots: boolean;
};

/**
 * The list's schedule at a glance: one bar per timed shot, from its time to the next
 * shot's, coloured like the tiles (red done, green active). The amber line is now.
 */
export function ScheduleGraph({ schedule, nowMin, live, selectedId, onSelect, hasShots }: Props) {
  const [width, setWidth] = useState(0);
  const track = useRef<View>(null);

  if (!hasShots) return null;
  if (!schedule) {
    return (
      <View style={styles.empty}>
        <Text style={[type.small, { color: colors.faint, textAlign: "center" }]}>
          Hold a shot and choose Set time to build the schedule graph
        </Text>
      </View>
    );
  }

  const { from, to, items } = schedule;
  const span = to - from;
  const x = (m: number) => ((m - from) / span) * width;
  const now = nowOnSchedule(schedule, nowMin);
  const nowVisible = now >= from && now <= to;
  const drift = live ? scheduleDrift(schedule, now) : null;
  const driftColor =
    drift?.kind === "behind" ? colors.record : drift?.kind === "ahead" || drift?.kind === "on" || drift?.kind === "wrapped" ? colors.markIn : colors.muted;

  // Hour labels: as many as fit without crowding.
  const hours = span / 60;
  const step = [1, 2, 3, 4, 6, 12].find((h) => (width / hours) * h >= 38) ?? 12;
  const ticks: number[] = [];
  for (let m = from; m <= to; m += 60) ticks.push(m);

  // Which bar was tapped: measured against the graph's position on screen (works the same on every platform).
  const onPress = (e: GestureResponderEvent) => {
    const pageX = e.nativeEvent.pageX;
    track.current?.measureInWindow((left, _top, w) => {
      if (!w) return;
      const m = from + ((pageX - left) / w) * span;
      const hit = items.find((i) => m >= i.x0 && m < i.x1) ?? items.reduce((a, b) => (Math.abs(b.x0 - m) < Math.abs(a.x0 - m) ? b : a));
      onSelect(hit.id);
    });
  };

  const summary = `Schedule ${formatMinutes(items[0].start)} to ${formatMinutes(items[items.length - 1].end)}, ${items.length} shots timed${
    drift ? `. ${driftLabel(drift)}` : ""
  }`;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={type.label}>Schedule</Text>
        <Text style={[type.small, styles.range]}>
          {formatMinutes(items[0].start)}–{formatMinutes(items[items.length - 1].end)}
          {schedule.untimed ? ` · ${schedule.untimed} untimed` : ""}
        </Text>
        {drift ? (
          <View style={[styles.chip, { borderColor: driftColor }]}>
            <Text style={[styles.chipText, { color: driftColor }]}>{driftLabel(drift)}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        ref={track}
        onPress={onPress}
        onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
        style={{ height: HEIGHT }}
        accessibilityRole="image"
        accessibilityLabel={summary}
        accessibilityHint="Tap a bar to select that shot"
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            <Rect x={0} y={BAR_TOP} width={width} height={BAR_H} rx={6} fill={colors.surface} />
            {ticks.map((m) => (
              <Line key={`g${m}`} x1={x(m)} x2={x(m)} y1={BAR_TOP} y2={BAR_TOP + BAR_H + 3} stroke={colors.border} strokeWidth={1} />
            ))}
            {items.map((i) => {
              const x0 = x(i.x0) + 0.75;
              const w = Math.max(x(i.x1) - x(i.x0) - 1.5, 1.5);
              const sel = i.id === selectedId;
              return (
                <G key={i.id}>
                  <Rect
                    x={x0}
                    y={BAR_TOP + 2}
                    width={w}
                    height={BAR_H - 4}
                    rx={3}
                    fill={fill(i.status)}
                    stroke={sel ? colors.text : "none"}
                    strokeWidth={sel ? 2 : 0}
                  />
                  {w >= 16 ? (
                    <SvgText
                      x={x0 + w / 2}
                      y={BAR_TOP + BAR_H / 2 + 4}
                      fontSize={10}
                      fontFamily={fonts.bold}
                      fill={i.status === "active" ? colors.bg : colors.text}
                      textAnchor="middle"
                    >
                      {String(i.number)}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
            {nowVisible ? (
              <G>
                <Line x1={x(now)} x2={x(now)} y1={BAR_TOP - 4} y2={BAR_TOP + BAR_H + 2} stroke={colors.markOut} strokeWidth={2} />
                <Path d={`M ${x(now) - 5} ${BAR_TOP - 9} L ${x(now) + 5} ${BAR_TOP - 9} L ${x(now)} ${BAR_TOP - 3} Z`} fill={colors.markOut} />
              </G>
            ) : null}
            {ticks
              .filter((m) => ((m - from) / 60) % step === 0)
              .map((m) => (
                <SvgText
                  key={`t${m}`}
                  x={Math.min(Math.max(x(m), 14), width - 14)}
                  y={HEIGHT - 2}
                  fontSize={10}
                  fontFamily={fonts.medium}
                  fill={colors.muted}
                  textAnchor="middle"
                >
                  {formatMinutes(m)}
                </SvgText>
              ))}
          </Svg>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  range: { flex: 1, fontVariant: ["tabular-nums"] },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
});
