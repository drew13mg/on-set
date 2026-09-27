import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { explainAuthError, MIN_PASSWORD, passwordProblem } from "@/lib/email-auth";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

/** Opened from the "reset your password" email: choose a new password. */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const fullUrl = Linking.useURL();
  const { completeEmailLink, updatePassword } = useAuth();
  const [stage, setStage] = useState<"opening" | "form" | "done" | "failed">("opening");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url =
      fullUrl && fullUrl.includes("reset-password")
        ? fullUrl
        : `onset://reset-password?${new URLSearchParams(
            Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][],
          ).toString()}`;
    completeEmailLink(url)
      .then(() => setStage("form"))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "This link didn't work.");
        setStage("failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const problem = passwordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setStage("done");
    } catch (e) {
      setError(explainAuthError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {stage === "opening" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : stage === "failed" ? (
          <View style={styles.center}>
            <Text style={type.heading}>That link didn't work</Text>
            <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>
              {error}. Reset links expire after a while; request a new one from Sign in → Forgot password.
            </Text>
            <Pressable onPress={() => router.replace("/account")} style={styles.primary}>
              <Text style={[type.button, { color: colors.bg }]}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : stage === "done" ? (
          <View style={styles.center}>
            <Text style={type.heading}>Password updated</Text>
            <Text style={[type.body, { color: colors.muted }]}>You're signed in.</Text>
            <Pressable onPress={() => router.replace("/")} style={styles.primary}>
              <Text style={[type.button, { color: colors.bg }]}>Go to projects</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <Text style={type.title}>New password</Text>
            <Text style={type.label}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              placeholder={`At least ${MIN_PASSWORD} characters`}
              placeholderTextColor={colors.faint}
              style={styles.input}
              accessibilityLabel="New password"
            />
            <Text style={type.label}>Confirm password</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              onSubmitEditing={save}
              placeholderTextColor={colors.faint}
              style={styles.input}
              accessibilityLabel="Confirm new password"
            />
            {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}
            <Pressable onPress={save} disabled={busy} style={styles.primary}>
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={[type.button, { color: colors.bg }]}>Save password</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: space.lg, justifyContent: "center" },
  center: { alignItems: "center", gap: space.md },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  primary: {
    marginTop: space.sm,
    height: 50,
    paddingHorizontal: space.xxl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
});
