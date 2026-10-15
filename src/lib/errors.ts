/**
 * Error text that may reach people. GitHub's messages can identify the account behind the server's
 * GITHUB_TOKEN (rate limits name the user ID; some errors echo request URLs), so stored errors are
 * scrubbed, and public pages only ever show a category.
 */

const SECRET_PATTERNS: [RegExp, string][] = [
  // Tokens: classic, fine-grained, App installation/user, OAuth.
  [/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[token]"],
  [/\b(Bearer|token)\s+[A-Za-z0-9._-]{16,}/gi, "$1 [token]"],
  // "API rate limit exceeded for user ID 1234567" and similar.
  [/\b(user|account|installation)\s+(ID\s*)?#?\d{3,}\b/gi, "$1 [id]"],
  [/\bfor\s+\d{5,}\b/g, "for [id]"],
  // Credentials or tokens in URLs.
  [/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/g, "$1"],
  [/([?&](access_token|token|client_secret|code)=)[^&\s]+/gi, "$1[redacted]"],
  // Signed artifact download URLs (they carry time-limited credentials).
  [/https:\/\/[^\s]*(blob\.core\.windows\.net|actions\.githubusercontent\.com)[^\s]*/g, "[artifact URL]"],
];

/** The message with tokens, account identifiers and signed URLs removed. */
export function redact(message: string): string {
  let out = message;
  for (const [re, sub] of SECRET_PATTERNS) out = out.replace(re, sub);
  return out.slice(0, 500);
}

/** A sentence for public pages: what kind of problem it is, never the details. */
export function publicError(message: string | null | undefined): string | null {
  if (!message) return null;
  const m = message.toLowerCase();
  if (m.includes("no github access") || m.includes("not found") || m.includes("404") || m.includes("resource not accessible"))
    return "ByteMatch can't access this repository's CI runs yet. Its maintainers can install the ByteMatch GitHub App on it.";
  if (m.includes("rate limit") || m.includes("403") || m.includes("429"))
    return "GitHub is limiting requests right now; ByteMatch will retry shortly.";
  if (m.includes("report") || m.includes("json") || m.includes("protobuf") || m.includes("artifact"))
    return "A CI report couldn't be read. The project's maintainers can see the details on its manage page.";
  if (m.includes("decomp.dev")) return "Importing history from decomp.dev failed; ByteMatch will retry.";
  return "The last sync attempt failed; ByteMatch will retry. The project's maintainers can see the details on its manage page.";
}
