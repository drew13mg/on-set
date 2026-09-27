import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import Svg, { Path } from "react-native-svg";
import { ActionSheet } from "@/components/ActionSheet";
import { EmailAuthForm } from "@/components/EmailAuthForm";
import { SignInCancelled, signInErrorMessage, useAuth } from "@/lib/auth";
import { clearDeviceData, useSync, useSyncStatus } from "@/lib/sync/SyncProvider";
import { supabase } from "@/lib/supabase";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

function AppleLogo() {
  return (
    <Svg width={16} height={18} viewBox="0 0 814 1000">
      <Path
        fill={colors.bg}
        d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 201-1 3-21 71-68 141-43 62-88 123-156 123s-86-40-164-40c-77 0-104 41-167 41s-106-57-156-127C45 787 0 664 0 547c0-188 122-287 243-287 64 0 117 42 157 42 38 0 98-45 171-45 28 0 128 3 194 84zm-230-178c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 102-30 134-72z"
      />
    </Svg>
  );
}

export default function Account() {
  const { me, nativeApple, signInWithApple, signInWithGoogle, signOut } = useAuth();
  const { engine } = useSync();
  const status = useSyncStatus();
  const [busy, setBusy] = useState<"apple" | "google" | "out" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const attempt = async (which: "apple" | "google") => {
    setBusy(which);
    setError(null);
    try {
      await (which === "apple" ? signInWithApple() : signInWithGoogle());
      if (router.canGoBack()) router.back();
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError(signInErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const doSignOut = async () => {
    setConfirmOut(false);
    setBusy("out");
    try {
      await engine.sync(); // send anything still waiting
    } catch {}
    await signOut();
    await clearDeviceData(engine);
    setBusy(null);
    router.dismissTo("/");
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    setBusy("delete");
    setError(null);
    const { error: e } = await supabase.rpc("delete_my_account");
    if (e) {
      setError("Couldn't delete your account. Check your connection and try again.");
      setBusy(null);
      return;
    }
    await signOut().catch(() => {});
    await clearDeviceData(engine);
    setBusy(null);
    router.dismissTo("/");
  };

  const syncLine = status.syncing
    ? "Syncing…"
    : status.error
      ? status.pending
        ? `Offline · ${status.pending} change${status.pending === 1 ? "" : "s"} waiting to upload`
        : "Can't reach the server right now"
      : status.pending
        ? `${status.pending} change${status.pending === 1 ? "" : "s"} uploading`
        : "Everything is up to date";

  if (!me) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.title}>Sign in</Text>
          <Text style={[type.body, { color: colors.muted }]}>
            Sign in to share projects with your crew and keep them on all your devices. Everyone on a project sees changes as they
            happen. ON SET keeps working offline and catches up when you're back in signal.
          </Text>

          <View style={{ gap: space.md, marginTop: space.lg }}>
            {Platform.OS === "ios" && nativeApple ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.md}
                style={{ height: 52 }}
                onPress={() => attempt("apple")}
              />
            ) : (
              <Pressable onPress={() => attempt("apple")} disabled={!!busy} style={[styles.btn, styles.appleBtn]}>
                {busy === "apple" ? <ActivityIndicator color={colors.bg} /> : <AppleLogo />}
                <Text style={[styles.btnText, { color: colors.bg }]}>Continue with Apple</Text>
              </Pressable>
            )}
            <Pressable onPress={() => attempt("google")} disabled={!!busy} style={[styles.btn, styles.googleBtn]}>
              {busy === "google" ? <ActivityIndicator color={colors.text} /> : <GoogleG />}
              <Text style={[styles.btnText, { color: colors.text }]}>Continue with Google</Text>
            </Pressable>
          </View>
          {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={type.label}>or use email</Text>
            <View style={styles.orLine} />
          </View>
          <EmailAuthForm onSignedIn={() => router.canGoBack() && router.back()} />

          <Text style={[type.small, { color: colors.faint, marginTop: space.lg }]}>
            Projects you've already made on this phone are kept and uploaded to your account when you sign in.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(me.name ?? me.email).slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.heading}>{me.name ?? "Signed in"}</Text>
            <Text style={type.small}>{me.email}</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: status.error ? colors.markOut : colors.markIn }]} />
          <Text style={type.small}>{syncLine}</Text>
        </View>

        <View style={styles.group}>
          <Pressable onPress={() => router.push("/groups")} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text style={type.body}>User groups</Text>
            <Text style={[type.body, { color: colors.faint }]}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => router.dismissTo({ pathname: "/", params: { join: "1" } })}
            style={({ pressed }) => [styles.item, styles.itemLast, pressed && styles.pressed]}
          >
            <Text style={type.body}>Join a project with a code</Text>
            <Text style={[type.body, { color: colors.faint }]}>›</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setConfirmOut(true)} disabled={busy === "out"} style={styles.signOut}>
          {busy === "out" ? <ActivityIndicator color={colors.record} /> : <Text style={[type.button, { color: colors.record }]}>Sign out</Text>}
        </Pressable>
        <Pressable onPress={() => setConfirmDelete(true)} disabled={busy === "delete"} style={styles.deleteLink} hitSlop={8}>
          {busy === "delete" ? <ActivityIndicator color={colors.muted} /> : <Text style={[type.small, { color: colors.muted }]}>Delete account</Text>}
        </Pressable>
        {error ? <Text style={[type.small, { color: colors.markOut, textAlign: "center" }]}>{error}</Text> : null}
      </ScrollView>

      <ActionSheet
        visible={confirmOut}
        title="Sign out?"
        message={
          status.pending
            ? `${status.pending} change${status.pending === 1 ? " hasn't" : "s haven't"} uploaded yet and will be lost. Your projects stay in your account; this phone's copy is removed.`
            : "Your projects stay in your account. This phone's copy is removed until you sign in again."
        }
        onClose={() => setConfirmOut(false)}
        actions={[{ label: "Sign out", destructive: true, onPress: doSignOut }]}
      />
      <ActionSheet
        visible={confirmDelete}
        title="Delete your account?"
        message="Permanently deletes your account, every project you own (for everyone it's shared with), your user groups and saved equipment. Projects others shared with you aren't affected. This can't be undone."
        onClose={() => setConfirmDelete(false)}
        actions={[{ label: "Delete account", destructive: true, onPress: doDelete }]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  btn: {
    height: 52,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  appleBtn: { backgroundColor: colors.text },
  googleBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText: { fontFamily: fonts.medium, fontSize: 17 },
  profile: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", marginTop: space.md },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemLast: { borderBottomWidth: 0 },
  pressed: { backgroundColor: colors.surfaceRaised },
  orRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.md },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  deleteLink: { alignSelf: "center", paddingVertical: space.md },
  signOut: {
    marginTop: space.xl,
    alignItems: "center",
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
