// Pure helpers for email + password sign-in (tested in tests/email-auth.test.ts).

export const MIN_PASSWORD = 8;

export function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

/** First problem with a new password, or null if it's fine. */
export function passwordProblem(pw: string, confirm: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use a mix of letters and numbers.";
  if (pw !== confirm) return "The passwords don't match.";
  return null;
}

export type EmailAuthError = { message: string; kind: "credentials" | "exists" | "unconfirmed" | "rate" | "weak" | "network" | "other" };

/** Turn Supabase auth errors into plain language. */
export function explainAuthError(e: unknown): EmailAuthError {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return { kind: "credentials", message: "Email or password is incorrect." };
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists"))
    return { kind: "exists", message: "There's already an account with this email. Sign in instead." };
  if (m.includes("email not confirmed")) return { kind: "unconfirmed", message: "Confirm your email first. Check your inbox for the link." };
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return { kind: "rate", message: "Too many attempts. Wait a minute and try again." };
  if (m.includes("password") && (m.includes("weak") || m.includes("at least") || m.includes("should contain")))
    return { kind: "weak", message: raw };
  if (m.includes("network") || m.includes("fetch")) return { kind: "network", message: "Can't reach the server. Check your connection." };
  return { kind: "other", message: raw || "Something went wrong. Please try again." };
}

/** Read `code` (or an error) from a link the auth emails open, e.g. onset://auth-callback?code=... */
export function parseAuthLink(url: string): { code: string | null; error: string | null } {
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const params = new URLSearchParams([q.split("#")[0], hash].filter(Boolean).join("&"));
  return {
    code: params.get("code"),
    error: params.get("error_description") ?? params.get("error"),
  };
}
