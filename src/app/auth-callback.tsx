import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { colors, radius, space, type } from "@/lib/theme";

/** Opened from the "confirm your email" link: finishes sign-in, then goes to Projects. */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const fullUrl = Linking.useURL();
  const { completeEmailLink, me } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url =
      fullUrl && fullUrl.includes("auth-callback")
        ? fullUrl
        : `onset://auth-callback?${new URLSearchParams(
            Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][],
          ).toString()}`;
    completeEmailLink(url)
      .then(() => router.replace("/"))
      .catch((e) => setError(e instanceof Error ? e.message : "This link didn't work."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={type.heading}>{me ? "You're signed in" : "That link didn't work"}</Text>
            <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>
              {me ? "Your email is confirmed." : `${error}. Links expire after a while; sign in to get a new one.`}
            </Text>
            <Pressable onPress={() => router.replace(me ? "/" : "/account")} style={styles.primary}>
              <Text style={[type.button, { color: colors.bg }]}>{me ? "Go to projects" : "Sign in"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.text} />
            <Text style={[type.body, { color: colors.muted }]}>Signing you in…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
  primary: {
    marginTop: space.md,
    height: 50,
    paddingHorizontal: space.xxl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
