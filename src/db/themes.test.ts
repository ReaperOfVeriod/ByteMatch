import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { TEST_DB, useTestDb } from "../../test/db";
import { setSetting } from "../lib/settings";
import { CODE_PATTERN, STYLES, THEMES, type Theme } from "../lib/theme";
import { db } from "./client";
import { sharedThemes } from "./schema";
import {
  findSharedTheme,
  listSharedThemes,
  pruneSharedThemes,
  refreshCodes,
  removeSharersThemes,
  SHARES_PER_HOUR,
  ShareRefusedError,
  sharerHash,
  setThemeRemoved,
  shareTheme,
} from "./themes";

const theme = (name: string): Theme => ({ name, palette: THEMES.teal.palette, style: STYLES.directory.style as Theme["style"] });

describe("sharerHash", () => {
  it("puts requests without an address in one bucket, not none", () => {
    expect(sharerHash(null)).toBe(sharerHash(null));
    expect(sharerHash(null)).not.toBe(sharerHash("203.0.113.7"));
  });
});

describe.skipIf(!TEST_DB)("shared themes", () => {
  useTestDb();

  it("gives a theme a readable code and finds it again", async () => {
    const code = await shareTheme(theme("Dusk"), "a");
    expect(code).toMatch(CODE_PATTERN);
    expect(await findSharedTheme(code)).toEqual({ ...theme("Dusk"), code });
    expect(await findSharedTheme("no-such-theme-10")).toBeNull();
  });

  it("gives the same theme the same code, and a changed one a new code", async () => {
    const a = await shareTheme(theme("Dusk"), "a");
    expect(await shareTheme(theme("Dusk"), "b")).toBe(a);
    expect(await shareTheme(theme("Dusk 2"), "a")).not.toBe(a);
  });

  it("limits how many new themes one sharer shares an hour", async () => {
    for (let i = 0; i < SHARES_PER_HOUR; i++) await shareTheme(theme(`T${i}`), "busy");
    await expect(shareTheme(theme("one more"), "busy")).rejects.toBeInstanceOf(ShareRefusedError);
    // Re-sharing an existing theme is free, and others aren't affected.
    await expect(shareTheme(theme("T0"), "busy")).resolves.toMatch(CODE_PATTERN);
    await expect(shareTheme(theme("one more"), "someone else")).resolves.toMatch(CODE_PATTERN);
  });

  it("stops at the site's daily limit, and while sharing is paused", async () => {
    await setSetting("themeDailyLimit", 2);
    await shareTheme(theme("A"), "x");
    await shareTheme(theme("B"), "y");
    await expect(shareTheme(theme("C"), "z")).rejects.toThrow(/today/);
    await setSetting("themeDailyLimit", 100);
    await setSetting("themeSharingPaused", true);
    await expect(shareTheme(theme("C"), "z")).rejects.toThrow(/paused/);
    // Existing codes keep working while paused.
    await expect(shareTheme(theme("A"), "z")).resolves.toMatch(CODE_PATTERN);
  });

  it("removed themes stop working and can't be shared again", async () => {
    const code = await shareTheme(theme("Rude"), "a");
    await setThemeRemoved(code, true);
    expect(await findSharedTheme(code)).toBeNull();
    await expect(shareTheme(theme("Rude"), "b")).rejects.toThrow(/removed/);
    expect(await refreshCodes([code])).toEqual([code]);
    await setThemeRemoved(code, false);
    expect(await findSharedTheme(code)).not.toBeNull();
  });

  it("removes a flood from one sharer at once", async () => {
    for (const n of ["F1", "F2", "F3"]) await shareTheme(theme(n), "flood");
    const keep = await shareTheme(theme("Fine"), "other");
    const { rows } = await listSharedThemes();
    expect(rows.find((r) => r.name === "F1")?.bySharer).toBe(3);
    expect(rows.find((r) => r.name === "Fine")?.bySharer).toBe(1);
    expect(await removeSharersThemes("flood")).toBe(3);
    expect(await findSharedTheme(keep)).not.toBeNull();
  });

  it("prunes codes nobody has used for long, unless someone still has them saved", async () => {
    const old = await shareTheme(theme("Old"), "a");
    const kept = await shareTheme(theme("Kept"), "a");
    const removed = await shareTheme(theme("Removed"), "a");
    await setThemeRemoved(removed, true);
    const longAgo = new Date(Date.now() - 400 * 86400_000);
    await db().update(sharedThemes).set({ lastUsedAt: longAgo });
    // Someone still has "Kept" saved, and their browser says so.
    expect(await refreshCodes([kept, "gone-code-11"])).toEqual(["gone-code-11"]);
    expect(await pruneSharedThemes()).toBe(1);
    expect(await findSharedTheme(old)).toBeNull();
    expect(await findSharedTheme(kept)).not.toBeNull();
    // The removed theme stays (as removed), so it still can't be shared again.
    expect(await db().select().from(sharedThemes).where(eq(sharedThemes.code, removed))).toHaveLength(1);
  });
});
