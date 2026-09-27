import { memo } from "react";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import type { SunEvent, SunPosition, SunSample } from "@/lib/sun";
import { sunAt } from "@/lib/sun";
import { fonts } from "@/lib/fonts";
import { colors, phaseColors } from "@/lib/theme";

type Props = {
  size: number;
  lat: number;
  lon: number;
  path: SunSample[];
  events: SunEvent[];
  sun: SunPosition;
};

/**
 * Top-down sky map. North is up, the outer ring is the horizon and the centre is
 * straight overhead. The arc is the sun's path for the day; the dot is the sun at
 * the slider's time, with a line showing the direction it's coming from.
 */
function SunCompassBase({ size, lat, lon, path, events, sun }: Props) {
  const pad = 26;
  const c = size / 2;
  const R = c - pad;

  const project = (az: number, alt: number) => {
    const r = (R * (90 - Math.max(0, Math.min(90, alt)))) / 90;
    const a = (az * Math.PI) / 180;
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };

  // Daytime path, drawn in short segments coloured by light phase.
  const segments: { d: string; color: string }[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a.altitude < 0 && b.altitude < 0) continue;
    const p1 = project(a.azimuth, a.altitude);
    const p2 = project(b.azimuth, b.altitude);
    const mid = (a.altitude + b.altitude) / 2;
    segments.push({
      d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)}L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
      color: mid >= 6 ? phaseColors.day : phaseColors.golden,
    });
  }

  const edgeMarks = events
    .filter((e) => e.key === "sunrise" || e.key === "sunset")
    .map((e) => ({ key: e.key, ...project(sunAt(e.at, lat, lon).azimuth, 0) }));

  const up = sun.altitude >= 0;
  const s = project(sun.azimuth, sun.altitude);
  const edge = project(sun.azimuth, 0);

  const cardinals: [string, number][] = [
    ["N", 0],
    ["E", 90],
    ["S", 180],
    ["W", 270],
  ];

  return (
    <Svg width={size} height={size} accessibilityLabel="Sun path compass">
      {/* Sky rings: horizon, 30° and 60° elevation */}
      <Circle cx={c} cy={c} r={R} fill={colors.surface} stroke={colors.border} strokeWidth={1.5} />
      <Circle cx={c} cy={c} r={(R * 60) / 90} fill="none" stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
      <Circle cx={c} cy={c} r={(R * 30) / 90} fill="none" stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
      <Line x1={c} y1={c - R} x2={c} y2={c + R} stroke={colors.border} strokeWidth={1} />
      <Line x1={c - R} y1={c} x2={c + R} y2={c} stroke={colors.border} strokeWidth={1} />

      {cardinals.map(([label, az]) => {
        const a = (az * Math.PI) / 180;
        const r = R + 14;
        return (
          <SvgText
            key={label}
            x={c + r * Math.sin(a)}
            y={c - r * Math.cos(a) + 5}
            fill={label === "N" ? colors.text : colors.muted}
            fontSize={13}
            fontFamily={fonts.bold}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}

      {segments.map((seg, i) => (
        <Path key={i} d={seg.d} stroke={seg.color} strokeWidth={4} strokeLinecap="round" />
      ))}

      {edgeMarks.map((m) => (
        <Circle key={m.key} cx={m.x} cy={m.y} r={5} fill={phaseColors.golden} stroke={colors.bg} strokeWidth={2} />
      ))}

      {/* Direction the light comes from */}
      <Line
        x1={c}
        y1={c}
        x2={edge.x}
        y2={edge.y}
        stroke={up ? colors.sun : colors.faint}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />

      <G>
        {up ? <Circle cx={s.x} cy={s.y} r={16} fill={colors.sun} opacity={0.18} /> : null}
        <Circle
          cx={s.x}
          cy={s.y}
          r={up ? 9 : 7}
          fill={up ? colors.sun : colors.bg}
          stroke={up ? colors.bg : colors.faint}
          strokeWidth={2}
        />
      </G>
    </Svg>
  );
}

export const SunCompass = memo(SunCompassBase);
