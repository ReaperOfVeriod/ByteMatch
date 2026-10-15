import { describe, expect, it } from "vitest";
import { TEST_DB, useTestDb } from "../../test/db";
import { CODE_PATTERN, STYLES, THEMES, type Theme } from "../lib/theme";
import { findSharedTheme, SHARES_PER_HOUR, ShareLimitError, shareTheme } from "./themes";

const theme = (name: string): Theme => ({ name, palette: THEMES.teal.palette, style: STYLES.directory.style as Theme["style"] });

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
    await expect(shareTheme(theme("one more"), "busy")).rejects.toBeInstanceOf(ShareLimitError);
    // Re-sharing an existing theme is free, and others aren't affected.
    await expect(shareTheme(theme("T0"), "busy")).resolves.toMatch(CODE_PATTERN);
    await expect(shareTheme(theme("one more"), "someone else")).resolves.toMatch(CODE_PATTERN);
  });
});
