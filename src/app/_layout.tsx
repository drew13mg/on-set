import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { AuthProvider } from "@/lib/auth";
import { ProjectsProvider } from "@/lib/projects-store";
import { SyncProvider } from "@/lib/sync/SyncProvider";
import { fontSources, fonts } from "@/lib/fonts";
import { colors } from "@/lib/theme";
import { SettingsButton } from "@/components/SettingsButton";

// Every project screen gets the settings gear in its top-right corner.
const projectScreen = (title: string) => ({ route }: { route: { params?: object } }) => ({
  title,
  headerRight: () => <SettingsButton projectId={String((route.params as { id?: string } | undefined)?.id ?? "")} />,
});

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts(fontSources);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <SyncProvider>
        <ProjectsProvider>
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
          <Stack.Screen name="project/[id]/index" options={projectScreen("")} />
          <Stack.Screen name="project/[id]/transcribe" options={projectScreen("Transcriptions")} />
          <Stack.Screen name="project/[id]/transcription/[tid]" options={projectScreen("Transcribe")} />
          <Stack.Screen name="project/[id]/clips" options={projectScreen("Clips")} />
          <Stack.Screen name="project/[id]/sun" options={projectScreen("Sun Tracker")} />
          <Stack.Screen name="project/[id]/equipment" options={projectScreen("Equipment")} />
          <Stack.Screen name="project/[id]/settings" options={{ title: "Project settings", presentation: "modal" }} />
          <Stack.Screen name="groups" options={{ title: "User groups" }} />
          <Stack.Screen name="account" options={{ title: "Account", presentation: "modal" }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ title: "Reset password" }} />
        </Stack>
        </ProjectsProvider>
      </SyncProvider>
    </AuthProvider>
  );
}
