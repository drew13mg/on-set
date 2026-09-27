import { test } from "node:test";
import assert from "node:assert/strict";

// parseEmails / formatCode are pure; import them without loading the Supabase client.
const { parseEmails, formatCode } = await import("../src/lib/sharing-text.ts");

test("parses emails from pasted text", () => {
  const r = parseEmails("Bob@Example.com, cara@crew.co;  bob@example.com\nnot-an-email  dan@x.io");
  assert.deepEqual(r.valid, ["bob@example.com", "cara@crew.co", "dan@x.io"]);
  assert.deepEqual(r.invalid, ["not-an-email"]);
  assert.deepEqual(parseEmails("   ").valid, []);
});

test("formats invite codes", () => {
  assert.equal(formatCode("REAWBQKC"), "REAW-BQKC");
  assert.equal(formatCode("ABC"), "ABC");
});
