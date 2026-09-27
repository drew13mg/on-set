import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useAuth } from "@/lib/auth";
import { explainAuthError, isEmail, MIN_PASSWORD, passwordProblem } from "@/lib/email-auth";
import { fonts } from "@/lib/fonts";
import { colors, radius, space, type } from "@/lib/theme";

type Mode = "signIn" | "create" | "forgot" | "checkEmail" | "resetSent";

function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.faint} style={[styles.input, style]} accessibilityLabel={label} {...rest} />
    </View>
  );
}

function PasswordField({ label, value, onChangeText, isNew, onSubmitEditing }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  isNew?: boolean;
  onSubmitEditing?: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <View style={styles.pwRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={isNew ? "newPassword" : "password"}
          autoComplete={isNew ? "new-password" : "current-password"}
          placeholder={isNew ? `At least ${MIN_PASSWORD} characters` : "Password"}
          placeholderTextColor={colors.faint}
          onSubmitEditing={onSubmitEditing}
          style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]}
          accessibilityLabel={label}
        />
        <Pressable onPress={() => setShown((s) => !s)} hitSlop={8} style={styles.show}>
          <Text style={[type.label, { color: colors.muted }]}>{shown ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Sign in with email + password, or create an account and choose a password. */
export function EmailAuthForm({ onSignedIn }: { onSignedIn: () => void }) {
  const { signInWithEmail, signUpWithEmail, resendConfirmation, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setCanResend(false);
    setPassword("");
    setConfirm("");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      const err = explainAuthError(e);
      setError(err.message);
      setCanResend(err.kind === "unconfirmed");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (mode === "signIn") {
      if (!password) return setError("Enter your password.");
      return run(async () => {
        await signInWithEmail(email, password);
        onSignedIn();
      });
    }
    if (mode === "create") {
      const problem = passwordProblem(password, confirm);
      if (problem) return setError(problem);
      return run(async () => {
        const { needsConfirmation } = await signUpWithEmail(email, password, name);
        if (needsConfirmation) go("checkEmail");
        else onSignedIn();
      });
    }
    if (mode === "forgot") {
      return run(async () => {
        await sendPasswordReset(email);
        go("resetSent");
      });
    }
  };

  const resend = () =>
    run(async () => {
      await resendConfirmation(email);
      setInfo("Sent. Check your inbox (and spam).");
    });

  if (mode === "checkEmail" || mode === "resetSent") {
    return (
      <View style={styles.card}>
        <Text style={type.heading}>Check your email</Text>
        <Text style={[type.body, { color: colors.muted }]}>
          {mode === "checkEmail"
            ? `We sent a confirmation link to ${email.trim()}. Open it on this phone to finish creating your account.`
            : `If there's an account for ${email.trim()}, we sent a link to choose a new password. Open it on this phone.`}
        </Text>
        {mode === "checkEmail" ? (
          <Pressable onPress={resend} disabled={busy} style={styles.linkBtn}>
            {busy ? <ActivityIndicator color={colors.text} /> : <Text style={[type.label, { color: colors.text }]}>Resend email</Text>}
          </Pressable>
        ) : null}
        {info ? <Text style={[type.small, { color: colors.markIn }]}>{info}</Text> : null}
        {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}
        <Pressable onPress={() => go("signIn")} style={styles.linkBtn}>
          <Text style={[type.label, { color: colors.muted }]}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  const title = mode === "signIn" ? "Sign in with email" : mode === "create" ? "Create your account" : "Reset your password";
  const action = mode === "signIn" ? "Sign in" : mode === "create" ? "Create account" : "Send reset link";

  return (
    <View style={styles.card}>
      <Text style={type.heading}>{title}</Text>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />

      {mode === "create" ? (
        <Field label="Your name (optional)" value={name} onChangeText={setName} placeholder="Shown to people you share with" textContentType="name" autoComplete="name" />
      ) : null}

      {mode !== "forgot" ? (
        <PasswordField
          label={mode === "create" ? "Create a password" : "Password"}
          value={password}
          onChangeText={setPassword}
          isNew={mode === "create"}
          onSubmitEditing={mode === "signIn" ? submit : undefined}
        />
      ) : null}
      {mode === "create" ? (
        <PasswordField label="Confirm password" value={confirm} onChangeText={setConfirm} isNew onSubmitEditing={submit} />
      ) : null}
      {mode === "create" ? (
        <Text style={[type.small, { color: colors.faint }]}>At least {MIN_PASSWORD} characters, with letters and numbers.</Text>
      ) : null}

      {error ? <Text style={[type.small, { color: colors.markOut }]}>{error}</Text> : null}
      {canResend ? (
        <Pressable onPress={resend} style={{ alignSelf: "flex-start" }}>
          <Text style={[type.label, { color: colors.text }]}>Resend confirmation email</Text>
        </Pressable>
      ) : null}
      {info ? <Text style={[type.small, { color: colors.markIn }]}>{info}</Text> : null}

      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={[type.button, { color: colors.bg }]}>{action}</Text>}
      </Pressable>

      {mode === "signIn" ? (
        <View style={styles.links}>
          <Pressable onPress={() => go("forgot")} hitSlop={6}>
            <Text style={[type.small, { color: colors.muted }]}>Forgot password?</Text>
          </Pressable>
          <Pressable onPress={() => go("create")} hitSlop={6}>
            <Text style={[type.small, { color: colors.text }]}>New here? Create an account</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => go("signIn")} hitSlop={6} style={{ alignSelf: "center" }}>
          <Text style={[type.small, { color: colors.text }]}>
            {mode === "create" ? "Already have an account? Sign in" : "Back to sign in"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pwRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  show: { paddingHorizontal: space.md },
  primary: { height: 50, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  links: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: space.sm },
  linkBtn: { alignSelf: "flex-start", paddingVertical: space.xs },
});
