import { and, count, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { sha256 } from "../lib/crypto";
import { config } from "../lib/config";
import { getSettings } from "../lib/settings";
import { newThemeCode } from "../lib/theme-codes";
import { parseTheme, serializeTheme, type Theme } from "../lib/theme";
import { db } from "./client";
import { sharedThemes } from "./schema";

/** How many new themes one address may share per hour. Re-sharing an existing theme is free. */
export const SHARES_PER_HOUR = 30;
/** Codes nobody has shared, opened, added or kept saved for this long are deleted. */
export const UNUSED_DAYS = 180;

/** Sharing was refused: a limit was reached, sharing is paused, or the theme was removed. */
export class ShareRefusedError extends Error {}

/**
 * Whose shares count together for the hourly limit: a salted hash of the address. Requests with no
 * address at all (no proxy headers) share one bucket, so they're limited together, never not at all.
 */
export function sharerHash(address: string | null): string {
  return sha256(`theme-share:${config().SECRET_KEY ?? ""}:${address ?? "no-address"}`);
}

/** The theme's code, sharing it first if nobody has. */
export async function shareTheme(theme: Theme, sharer: string): Promise<string> {
  const contentHash = sha256(serializeTheme(theme));
  const d = db();
  const [existing] = await d
    .select({ code: sharedThemes.code, removedAt: sharedThemes.removedAt })
    .from(sharedThemes)
    .where(eq(sharedThemes.contentHash, contentHash));
  if (existing?.removedAt) throw new ShareRefusedError("This theme was removed by the site's moderators and can't be shared.");
  if (existing) {
    await d.update(sharedThemes).set({ lastUsedAt: new Date() }).where(eq(sharedThemes.code, existing.code));
    return existing.code;
  }

  const settings = await getSettings();
  if (settings.themeSharingPaused)
    throw new ShareRefusedError("Sharing new themes is paused on this site right now. Your theme is still saved here.");
  const since = (ms: number) => new Date(Date.now() - ms);
  const [[mine], [today]] = await Promise.all([
    d
      .select({ n: count() })
      .from(sharedThemes)
      .where(and(eq(sharedThemes.sharerHash, sharer), gt(sharedThemes.createdAt, since(3600_000)))),
    d
      .select({ n: count() })
      .from(sharedThemes)
      .where(gt(sharedThemes.createdAt, since(86400_000))),
  ]);
  if (mine.n >= SHARES_PER_HOUR) throw new ShareRefusedError("You've shared a lot of themes in the last hour. Try again later.");
  if (today.n >= settings.themeDailyLimit) {
    throw new ShareRefusedError("A lot of themes have been shared on this site today. Try again tomorrow; your theme is still saved here.");
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const [row] = await d
      .insert(sharedThemes)
      .values({
        code: newThemeCode(),
        name: theme.name,
        palette: { ...theme.palette },
        style: { ...theme.style },
        contentHash,
        sharerHash: sharer,
      })
      .onConflictDoNothing()
      .returning({ code: sharedThemes.code });
    if (row) return row.code;
    // Either the code was taken (try another) or someone shared the same theme a moment ago.
    const [raced] = await d.select({ code: sharedThemes.code }).from(sharedThemes).where(eq(sharedThemes.contentHash, contentHash));
    if (raced) return raced.code;
  }
  throw new Error("Could not find a free theme code.");
}

/** The theme behind a code, re-checked by the same parser as any other theme; opening it counts as use. */
export async function findSharedTheme(code: string): Promise<Theme | null> {
  const [row] = await db()
    .update(sharedThemes)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(sharedThemes.code, code), isNull(sharedThemes.removedAt)))
    .returning();
  if (!row) return null;
  const r = parseTheme(`bytematch-theme:2:${JSON.stringify({ name: row.name, palette: row.palette, style: row.style })}`);
  return r.ok ? { ...r.theme, code: row.code } : null;
}

/**
 * Marks codes someone still has saved as in use, and says which of them no longer work (removed or
 * pruned), so the browser can drop them.
 */
export async function refreshCodes(codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const live = await db()
    .update(sharedThemes)
    .set({ lastUsedAt: new Date() })
    .where(and(inArray(sharedThemes.code, codes), isNull(sharedThemes.removedAt)))
    .returning({ code: sharedThemes.code });
  const ok = new Set(live.map((r) => r.code));
  return codes.filter((c) => !ok.has(c));
}

/** Deletes codes unused for DAYS. Removed themes stay, so they can't simply be shared again. */
export async function pruneSharedThemes(days = UNUSED_DAYS): Promise<number> {
  const rows = await db()
    .delete(sharedThemes)
    .where(and(isNull(sharedThemes.removedAt), lt(sharedThemes.lastUsedAt, new Date(Date.now() - days * 86400_000))))
    .returning({ code: sharedThemes.code });
  return rows.length;
}

export async function setThemeRemoved(code: string, removed: boolean): Promise<boolean> {
  const rows = await db()
    .update(sharedThemes)
    .set({ removedAt: removed ? new Date() : null })
    .where(eq(sharedThemes.code, code))
    .returning({ code: sharedThemes.code });
  return rows.length > 0;
}

/** Removes every live theme one sharer created: for clearing out a flood. */
export async function removeSharersThemes(sharer: string): Promise<number> {
  const rows = await db()
    .update(sharedThemes)
    .set({ removedAt: new Date() })
    .where(and(eq(sharedThemes.sharerHash, sharer), isNull(sharedThemes.removedAt)))
    .returning({ code: sharedThemes.code });
  return rows.length;
}

/** For the admin page: newest first, with how many each sharer has made. */
export async function listSharedThemes(limit = 100) {
  const [rows, [stats]] = await Promise.all([
    db()
      .select({
        code: sharedThemes.code,
        name: sharedThemes.name,
        palette: sharedThemes.palette,
        sharerHash: sharedThemes.sharerHash,
        createdAt: sharedThemes.createdAt,
        lastUsedAt: sharedThemes.lastUsedAt,
        removedAt: sharedThemes.removedAt,
      })
      .from(sharedThemes)
      .orderBy(desc(sharedThemes.createdAt))
      .limit(limit),
    db()
      .select({
        total: sql<number>`count(*) filter (where ${sharedThemes.removedAt} is null)::int`,
        removed: sql<number>`count(*) filter (where ${sharedThemes.removedAt} is not null)::int`,
        today: sql<number>`count(*) filter (where ${sharedThemes.createdAt} > now() - interval '24 hours')::int`,
      })
      .from(sharedThemes),
  ]);
  const sharers = [...new Set(rows.flatMap((r) => (r.sharerHash ? [r.sharerHash] : [])))];
  const counts = sharers.length
    ? await db()
        .select({ sharer: sharedThemes.sharerHash, n: count() })
        .from(sharedThemes)
        .where(inArray(sharedThemes.sharerHash, sharers))
        .groupBy(sharedThemes.sharerHash)
    : [];
  const bySharer = new Map(counts.map((c) => [c.sharer, c.n]));
  return { rows: rows.map((r) => ({ ...r, bySharer: (r.sharerHash && bySharer.get(r.sharerHash)) || 1 })), stats };
}
