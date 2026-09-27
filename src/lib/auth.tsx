import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { uuid } from "./id";
import { parseAuthLink } from "./email-auth";
import { unregisterPush } from "./push";

WebBrowser.maybeCompleteAuthSession();

export type Me = { id: string; email: string; name: string | null };

type AuthCtx = {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  /** Native Sign in with Apple is only on iPhone/iPad; elsewhere Apple uses the browser flow. */
  nativeApple: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Existing account: email + password. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** New account: the person creates their password. Returns whether an email confirmation is required first. */
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  /** Finish sign-in from a link in a confirmation or reset email. */
  completeEmailLink: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export class SignInCancelled extends Error {}

/** Friendlier text for errors people might actually see. */
export function signInErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/provider is not enabled|unsupported provider/i.test(msg)) {
    return "This sign-in option isn't switched on yet. See the setup steps in the README.";
  }
  if (/network|fetch/i.test(msg)) return "Can't reach the server. Check your connection and try again.";
  return msg || "Sign-in didn't work. Please try again.";
}

function toMe(session: Session | null): Me | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name ?? meta.name ?? null) as string | null;
  return { id: u.id, email: (u.email ?? "").toLowerCase(), name };
}

async function browserSignIn(provider: "google" | "apple") {
  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new SignInCancelled();
  const url = new URL(result.url);
  const errText = url.searchParams.get("error_description");
  if (errText) throw new Error(errText);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("Sign-in didn't return a code.");
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) throw exErr;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [nativeApple, setNativeApple] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setNativeApple).catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!nativeApple) return browserSignIn("apple");
    const rawNonce = uuid();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    let cred: AppleAuthentication.AppleAuthenticationCredential;
    try {
      cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") throw new SignInCancelled();
      throw e;
    }
    if (!cred.identityToken) throw new Error("Apple didn't return a sign-in token.");
    const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce: rawNonce });
    if (error) throw error;
    // Apple only shares the name on the very first sign-in; keep it.
    const full = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ");
    if (full) await supabase.auth.updateUser({ data: { full_name: full } });
  }, [nativeApple]);

  const signInWithGoogle = useCallback(() => browserSignIn("google"), []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: Linking.createURL("auth-callback"),
        data: name?.trim() ? { full_name: name.trim() } : undefined,
      },
    });
    if (error) throw error;
    // Supabase hides whether an address is already registered: an existing account comes back with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }
    return { needsConfirmation: !data.session };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: Linking.createURL("auth-callback") },
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: Linking.createURL("reset-password"),
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const completeEmailLink = useCallback(async (url: string) => {
    const { code, error } = parseAuthLink(url);
    if (error) throw new Error(error);
    if (!code) return;
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) {
      // The same link can arrive twice (e.g. after the browser sign-in already used it).
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw exErr;
    }
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      me: toMe(session),
      nativeApple,
      signInWithApple,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resendConfirmation,
      sendPasswordReset,
      updatePassword,
      completeEmailLink,
      signOut,
    }),
    [
      ready,
      session,
      nativeApple,
      signInWithApple,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resendConfirmation,
      sendPasswordReset,
      updatePassword,
      completeEmailLink,
      signOut,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}
