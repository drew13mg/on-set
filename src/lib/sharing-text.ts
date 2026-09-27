// Pure helpers for sharing (tested in tests/sharing.test.ts).

/** Pull emails out of free text: "a@x.com, b@y.com  c@z.com". */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p)) {
      if (!valid.includes(p)) valid.push(p);
    } else invalid.push(p);
  }
  return { valid, invalid };
}

/** "REAWBQKC" → "REAW-BQKC" */
export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);
