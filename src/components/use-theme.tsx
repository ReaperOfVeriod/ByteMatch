"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CHOSEN_COOKIE,
  CODE_PATTERN,
  CUSTOM_KEY,
  DEFAULT_CHOSEN,
  encodeChosen,
  paletteVars,
  parseTheme,
  SLOTS,
  STYLE_KEYS,
  themeAttrs,
  THEME_EVENT,
  type Chosen,
  type Palette,
  type Style,
  type Theme,
} from "@/lib/theme";

interface ThemeContext {
  chosen: Chosen;
  /** Switch colours, style or both; remembered in the cookie. Layout changes re-render the page. */
  choose: (next: Partial<Chosen>) => void;
  /** Show a palette and style without remembering them (the editor's live preview). */
  preview: (palette: Palette, style: Style) => void;
  /** Put the chosen theme back after a preview. */
  endPreview: () => void;
  custom: Theme[];
  saveCustom: (list: Theme[]) => void;
}

const Ctx = createContext<ThemeContext | null>(null);

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c;
}

/** Write a palette and style onto <html>, the same properties the server renders from the cookie. */
function paint(palette: Palette, style: Style) {
  const root = document.documentElement;
  const vars = paletteVars(palette);
  for (const { css } of SLOTS) {
    if (vars[css]) root.style.setProperty(css, vars[css]);
    else root.style.removeProperty(css);
  }
  root.style.colorScheme = vars.colorScheme ?? "";
  for (const [k, v] of Object.entries(themeAttrs(palette, style))) {
    if (v === undefined) root.removeAttribute(k);
    else root.setAttribute(k, v);
  }
  paintIcon(palette);
}

/**
 * The tab icon and the mobile browser bar follow the theme: the mark redrawn in its accent. Slate
 * keeps the site's own icon.
 */
function paintIcon(palette: Palette) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = palette.bg;
  const tinted = Object.keys(paletteVars(palette)).length > 0;
  let link = document.getElementById("theme-icon") as HTMLLinkElement | null;
  if (!tinted) {
    link?.remove();
    return;
  }
  const svg = markSvg(palette, 64);
  if (!link) {
    link = document.createElement("link");
    link.id = "theme-icon";
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.append(link);
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** ByteMatch's mark as a standalone SVG in a palette's colours (the header draws it with CSS). */
export function markSvg(palette: Palette, size: number) {
  const mix = (a: string, b: string, t: number) => {
    const [x, y] = [a, b].map((h) => parseInt(h.slice(1), 16));
    const c = [16, 8, 0].map((s) => Math.round(((x >> s) & 255) * t + ((y >> s) & 255) * (1 - t)));
    return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const on = palette.accent;
  const part = mix(palette.accent, palette.surface, 0.45);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${palette.bg}"/><rect x="11" y="11" width="24" height="24" rx="5" fill="${on}"/><rect x="39" y="11" width="14" height="14" rx="4" fill="${on}"/><rect x="39" y="29" width="14" height="24" rx="4" fill="${part}"/><rect x="11" y="39" width="24" height="14" rx="4" fill="${on}"/></svg>`;
}

function subscribe(notify: () => void) {
  const onStorage = (e: StorageEvent) => e.key === CUSTOM_KEY && notify();
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

function readCustom() {
  try {
    return localStorage.getItem(CUSTOM_KEY);
  } catch {
    return null;
  }
}

/** Saved themes, each re-checked by the same parser as a pasted one. */
function parseCustom(raw: string | null): Theme[] {
  let list: unknown;
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((t) => {
    const r = parseTheme(`bytematch-theme:2:${JSON.stringify(t)}`);
    if (!r.ok) return [];
    const code = (t as { code?: unknown }).code;
    return [typeof code === "string" && CODE_PATTERN.test(code) ? { ...r.theme, code } : r.theme];
  });
}

/** Holds the chosen theme. The server renders it from the cookie; this keeps <html> in step. */
export function ThemeProvider({ initial, children }: { initial: Chosen; children: React.ReactNode }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(initial);
  const customRaw = useSyncExternalStore(subscribe, readCustom, () => null);
  const custom = useMemo(() => parseCustom(customRaw), [customRaw]);

  // The icon is drawn client-side, once the page is up.
  useEffect(() => {
    paintIcon(initial.palette);
  }, [initial.palette]);

  // The choice as of now, for ending previews. Set in choose() as well as here, because a child's
  // effects (the editor closing, say) run before this component's.
  const latest = useRef(chosen);
  useEffect(() => {
    latest.current = chosen;
  }, [chosen]);

  const choose = useCallback(
    (next: Partial<Chosen>) => {
      const c = { ...chosen, ...next };
      const isDefault = c.colours === DEFAULT_CHOSEN.colours && STYLE_KEYS.every((k) => c.style[k] === DEFAULT_CHOSEN.style[k]);
      document.cookie = isDefault
        ? `${CHOSEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`
        : `${CHOSEN_COOKIE}=${encodeChosen(c)}; path=/; max-age=31536000; SameSite=Lax`;
      paint(c.palette, c.style);
      latest.current = c;
      setChosen(c);
      // Layout is markup the server renders, so a new layout needs a fresh render.
      if (c.style.layout !== chosen.style.layout) router.refresh();
    },
    [chosen, router],
  );

  // A stable way back from a preview, to whatever is chosen by then.
  const endPreview = useCallback(() => paint(latest.current.palette, latest.current.style), []);

  const value = useMemo<ThemeContext>(
    () => ({
      chosen,
      choose,
      preview: paint,
      endPreview,
      custom,
      saveCustom: (list) => {
        try {
          localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.map(({ name, palette, style, code }) => ({ name, palette, style, code }))));
        } catch {
          // Storage blocked: nothing to keep them in.
        }
        window.dispatchEvent(new Event(THEME_EVENT));
      },
    }),
    [chosen, choose, endPreview, custom],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
