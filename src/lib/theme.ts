import type { TextStyle } from "react-native";
import { fonts } from "./fonts";

// ON SET look: modern and clean on a dark slate grey base.
export const colors = {
  bg: "#1C2127", // dark slate grey
  surface: "#252B33",
  surfaceRaised: "#2F3640",
  border: "#39414C",
  text: "#EEF1F4",
  muted: "#8B95A1",
  faint: "#5C6672",
  markIn: "#34D399",
  markOut: "#F59E0B",
  record: "#EF4444",
  accent: "#E8EDF2",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

export const type = {
  title: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: 2, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: 0.5, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: colors.muted },
  button: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1.2, textTransform: "uppercase" },
  time: { fontFamily: fonts.medium, fontSize: 15, ...tabular, color: colors.text },
  timeLarge: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: 1, ...tabular, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
} satisfies Record<string, TextStyle>;
