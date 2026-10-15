import { and, count, eq, gt } from "drizzle-orm";
import { sha256 } from "../lib/crypto";
import { newThemeCode } from "../lib/theme-codes";
import { parseTheme, serializeTheme, type Theme } from "../lib/theme";
import { db } from "./client";
import { sharedThemes } from "./schema";

/** How many new themes one address may share per hour. Re-sharing an existing theme is free. */
export const SHARES_PER_HOUR = 30;

export class ShareLimitError extends Error {}

/** The theme's code, sharing it first if nobody has. */
export async function shareTheme(theme: Theme, sharerHash: string | null): Promise<string> {
  const text = serializeTheme(theme);
  const contentHash = sha256(text);
  const d = db();
  const [existing] = await d.select({ code: sharedThemes.code }).from(sharedThemes).where(eq(sharedThemes.contentHash, contentHash));
  if (existing) return existing.code;

  if (sharerHash) {
    const [{ n }] = await d
      .select({ n: count() })
      .from(sharedThemes)
      .where(and(eq(sharedThemes.sharerHash, sharerHash), gt(sharedThemes.createdAt, new Date(Date.now() - 3600_000))));
    if (n >= SHARES_PER_HOUR) throw new ShareLimitError("You've shared a lot of themes in the last hour. Try again later.");
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const [row] = await d
      .insert(sharedThemes)
      .values({ code: newThemeCode(), name: theme.name, palette: { ...theme.palette }, style: { ...theme.style }, contentHash, sharerHash })
      .onConflictDoNothing()
      .returning({ code: sharedThemes.code });
    if (row) return row.code;
    // Either the code was taken (try another) or someone shared the same theme a moment ago.
    const [raced] = await d.select({ code: sharedThemes.code }).from(sharedThemes).where(eq(sharedThemes.contentHash, contentHash));
    if (raced) return raced.code;
  }
  throw new Error("Could not find a free theme code.");
}

/** The theme behind a code, re-checked by the same parser as any other theme. */
export async function findSharedTheme(code: string): Promise<Theme | null> {
  const [row] = await db().select().from(sharedThemes).where(eq(sharedThemes.code, code));
  if (!row) return null;
  const r = parseTheme(`bytematch-theme:2:${JSON.stringify({ name: row.name, palette: row.palette, style: row.style })}`);
  return r.ok ? { ...r.theme, code: row.code } : null;
}
