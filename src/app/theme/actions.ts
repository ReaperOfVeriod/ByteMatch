"use server";

import { headers } from "next/headers";
import { findSharedTheme, ShareLimitError, shareTheme } from "@/db/themes";
import { config } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { normalizeCode, parseTheme, type Theme } from "@/lib/theme";

export type ShareResult = { code: string } | { error: string };
export type LookupResult = { theme: Theme } | { error: string };

/** Only for the hourly limit: the address is never stored, just a salted hash of it. */
async function sharerHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return ip ? sha256(`theme-share:${config().SECRET_KEY ?? ""}:${ip}`) : null;
}

/** Give a theme its share code. The theme arrives as its text form and is checked like any other. */
export async function shareThemeAction(text: string): Promise<ShareResult> {
  const r = parseTheme(text);
  if (!r.ok) return { error: r.error };
  try {
    return { code: await shareTheme(r.theme, await sharerHash()) };
  } catch (e) {
    if (e instanceof ShareLimitError) return { error: e.message };
    console.error("shareThemeAction", e);
    return { error: "The theme couldn't be shared just now. It's still saved here; try again in a moment." };
  }
}

/** The theme behind a code someone typed, or a pasted theme line (from Albedo, say). */
export async function lookupThemeAction(input: string): Promise<LookupResult> {
  if (/^\s*(bytematch|albedo)-theme:/.test(input)) {
    const r = parseTheme(input);
    return r.ok ? { theme: r.theme } : { error: r.error };
  }
  const code = normalizeCode(input);
  if (!code) return { error: "Theme codes look like brave-otter-12: two words and a number." };
  try {
    const theme = await findSharedTheme(code);
    return theme ? { theme } : { error: `No theme has the code ${code}. Check the spelling with whoever shared it.` };
  } catch (e) {
    console.error("lookupThemeAction", e);
    return { error: "Themes can't be looked up just now. Try again in a moment." };
  }
}
