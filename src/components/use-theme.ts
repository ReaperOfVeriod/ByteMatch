"use client";

import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { applyTheme, CHOSEN_KEY, chosenTheme, CUSTOM_KEY, customThemes, DEFAULT_PRESET, THEME_EVENT } from "@/lib/theme";

function subscribe(notify: () => void) {
  const onStorage = (e: StorageEvent) => {
    // Another tab chose a theme: follow it here too.
    if (e.key === CHOSEN_KEY) applyTheme(chosenTheme()?.palette ?? null);
    if (e.key === CHOSEN_KEY || e.key === CUSTOM_KEY) notify();
  };
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

const raw = (key: string) => () => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** The chosen theme's id ("preset:slate" when nothing is chosen) and the saved custom themes. */
export function useThemes() {
  const chosenRaw = useSyncExternalStore(subscribe, raw(CHOSEN_KEY), () => null);
  const customRaw = useSyncExternalStore(subscribe, raw(CUSTOM_KEY), () => null);
  // Parsed from the snapshots, never re-read from storage, so hydration sees the server's null.
  const chosen = useMemo(() => chosenTheme(chosenRaw), [chosenRaw]);
  const custom = useMemo(() => customThemes(customRaw), [customRaw]);
  return { chosenId: chosen?.id ?? `preset:${DEFAULT_PRESET}`, chosen, custom };
}

/**
 * Re-applies the remembered theme after hydration. The <head> script already did it for the first
 * paint; in development React's remount clears <html>'s inline style, and this puts it back.
 */
export function useReapplyTheme() {
  useLayoutEffect(() => {
    const c = chosenTheme();
    if (c) applyTheme(c.palette);
  }, []);
}
