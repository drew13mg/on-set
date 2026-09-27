import { test } from "node:test";
import assert from "node:assert/strict";
import { explainAuthError, isEmail, parseAuthLink, passwordProblem } from "../src/lib/email-auth.ts";

test("email check", () => {
  assert.ok(isEmail(" andrew@pistons.com "));
  assert.ok(!isEmail("andrew@pistons"));
  assert.ok(!isEmail("not an email"));
});

test("new password rules", () => {
  assert.equal(passwordProblem("short1", "short1"), "Use at least 8 characters.");
  assert.equal(passwordProblem("allletters", "allletters"), "Use a mix of letters and numbers.");
  assert.equal(passwordProblem("onset2026", "onset2027"), "The passwords don't match.");
  assert.equal(passwordProblem("onset2026", "onset2026"), null);
});

test("auth errors in plain language", () => {
  assert.equal(explainAuthError(new Error("Invalid login credentials")).kind, "credentials");
  assert.equal(explainAuthError({ message: "User already registered" }).kind, "exists");
  assert.equal(explainAuthError(new Error("Email not confirmed")).kind, "unconfirmed");
  assert.equal(explainAuthError(new Error("email rate limit exceeded")).kind, "rate");
  assert.equal(explainAuthError(new Error("For security purposes, you can only request this after 42 seconds.")).kind, "rate");
  assert.equal(explainAuthError(new Error("TypeError: Network request failed")).kind, "network");
  assert.equal(explainAuthError(new Error("Something odd")).message, "Something odd");
});

test("reads codes and errors from email links", () => {
  assert.deepEqual(parseAuthLink("onset://auth-callback?code=abc123"), { code: "abc123", error: null });
  assert.deepEqual(parseAuthLink("onset://reset-password?code=xyz"), { code: "xyz", error: null });
  assert.deepEqual(parseAuthLink("onset://auth-callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired"), {
    code: null,
    error: "Email link is invalid or has expired",
  });
  assert.deepEqual(parseAuthLink("onset://auth-callback"), { code: null, error: null });
});
