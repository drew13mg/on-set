// ON SET fonts.
//
// The app refers to fonts only by the family names below (OnSet-Regular, etc.),
// so switching typefaces never touches the screens.
//
// DIN Pro is a licensed font and isn't bundled yet. Until it is, Barlow (a free,
// DIN-inspired typeface) stands in. To switch to DIN Pro:
//   1. Put your licensed files in assets/fonts/ (e.g. DINPro-Regular.otf,
//      DINPro-Medium.otf, DINPro-Bold.otf).
//   2. Replace the three Barlow `require(...)` lines below with, e.g.:
//        "OnSet-Regular": require("../../assets/fonts/DINPro-Regular.otf"),
//        "OnSet-Medium":  require("../../assets/fonts/DINPro-Medium.otf"),
//        "OnSet-Bold":    require("../../assets/fonts/DINPro-Bold.otf"),
import type { FontSource } from "expo-font";

export const fontSources: Record<string, FontSource> = {
  "OnSet-Regular": require("@expo-google-fonts/barlow/400Regular/Barlow_400Regular.ttf"),
  "OnSet-Medium": require("@expo-google-fonts/barlow/500Medium/Barlow_500Medium.ttf"),
  "OnSet-Bold": require("@expo-google-fonts/barlow/700Bold/Barlow_700Bold.ttf"),
};

export const fonts = {
  regular: "OnSet-Regular",
  medium: "OnSet-Medium",
  bold: "OnSet-Bold",
} as const;
