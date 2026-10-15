"use server";

import { headers } from "next/headers";
import { findSharedTheme, refreshCodes, ShareRefusedError, sharerHash, shareTheme } from "@/db/themes";
import { clientAddress } from "@/lib/client-address";
import { CODE_PATTERN, normalizeCode, parseTheme, type Theme } from "@/lib/theme";

export type ShareResult = { code: string } | { error: string };
export type LookupResult = { theme: Theme } | { error: string };

/** Give a theme its share code. The theme arrives as its text form and is checked like any other. */
export async function shareThemeAction(text: string): Promise<ShareResult> {
  const r = parseTheme(text);
  if (!r.ok) return { error: r.error };
  try {
    return { code: await shareTheme(r.theme, sharerHash(clientAddress(await headers()))) };
  } catch (e) {
    if (e instanceof ShareRefusedError) return { error: e.message };
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

/** Keeps the codes of themes someone still has saved alive, and names any that no longer work. */
export async function refreshCodesAction(codes: string[]): Promise<{ missing: string[] }> {
  const valid = [...new Set(codes.filter((c) => typeof c === "string" && CODE_PATTERN.test(c)))].slice(0, 100);
  try {
    return { missing: await refreshCodes(valid) };
  } catch (e) {
    console.error("refreshCodesAction", e);
    return { missing: [] };
  }
}
