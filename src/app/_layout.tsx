import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { ClipsProvider } from "@/lib/clips-store";
import { ProjectsProvider } from "@/lib/projects-store";
import { TranscriptionsProvider } from "@/lib/transcriptions-store";
import { EquipmentLibraryProvider } from "@/lib/equipment-store";
import { fontSources, fonts } from "@/lib/fonts";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts(fontSources);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ClipsProvider>
      <TranscriptionsProvider>
      <ProjectsProvider>
        <EquipmentLibraryProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="project/[id]/index" options={{ title: "" }} />
          <Stack.Screen name="project/[id]/transcribe" options={{ title: "Transcriptions" }} />
          <Stack.Screen name="project/[id]/transcription/[tid]" options={{ title: "Transcribe" }} />
          <Stack.Screen name="project/[id]/clips" options={{ title: "Clips" }} />
          <Stack.Screen name="project/[id]/sun" options={{ title: "Sun Tracker" }} />
          <Stack.Screen name="project/[id]/equipment" options={{ title: "Equipment" }} />
        </Stack>
        </EquipmentLibraryProvider>
      </ProjectsProvider>
      </TranscriptionsProvider>
    </ClipsProvider>
  );
}
