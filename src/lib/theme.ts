/**
 * The colour theme model. A theme is `{ name, palette }`, and a palette is exactly the thirteen
 * slots below: applyTheme writes them onto <html> and cannot write anything else, so every other
 * colour in globals.css is derived from them. docs/theming.md is the ruling on what goes where.
 *
 * The slot-and-derive model and the copy/paste format follow Albedo's @albedo/ui-theme; the
 * Light and Graphite presets come from the redesign proposed in PR #1.
 */

export interface Palette {
  bg: string;
  surface: string;
  line: string;
  text: string;
  dim: string;
  accent: string;
  done: string;
  partial: string;
  series1: string;
  series2: string;
  good: string;
  bad: string;
  warn: string;
}

export type Slot = keyof Palette;

export interface Theme {
  name: string;
  palette: Palette;
}

/** The slots in the order editors offer them, with the CSS property each one writes. */
export const SLOTS: { slot: Slot; css: string; label: string; role: string }[] = [
  { slot: "bg", css: "--bg", label: "Background", role: "The page behind everything." },
  { slot: "surface", css: "--surface", label: "Surface", role: "Panels and cards. Raised surfaces mix it toward Line." },
  { slot: "line", css: "--line", label: "Line", role: "Borders and dividers." },
  { slot: "text", css: "--text", label: "Text", role: "Body text and headings." },
  { slot: "dim", css: "--text-3", label: "Dim text", role: "Labels, units and secondary text." },
  { slot: "accent", css: "--accent", label: "Accent", role: "Links, focus and the current item. Buttons use a deeper shade." },
  { slot: "done", css: "--done", label: "Matched", role: "Matched code: progress bars and finished units." },
  { slot: "partial", css: "--partial", label: "In progress", role: "Units with some matched code." },
  { slot: "series1", css: "--series-1", label: "Series 1", role: "Code matched in charts, and the Data bar." },
  { slot: "series2", css: "--series-2", label: "Series 2", role: "Functions matched in charts." },
  { slot: "good", css: "--good", label: "Good", role: "Gains and healthy states." },
  { slot: "bad", css: "--bad", label: "Bad", role: "Regressions, errors and destructive actions." },
  { slot: "warn", css: "--warn", label: "Warning", role: "Warnings, and nothing else." },
];

/** Slate's palette: the default theme, and equal to the :root values in globals.css. */
const SLATE: Palette = {
  bg: "#0b0f17",
  surface: "#111723",
  line: "#253047",
  text: "#e6ecf5",
  dim: "#8592a8",
  accent: "#5b9cf5",
  done: "#2f9e44",
  partial: "#2563b8",
  series1: "#3987e5",
  series2: "#d95926",
  good: "#46b964",
  bad: "#ef6b6b",
  warn: "#f0b429",
};

/** A near-black theme around one accent: neutrals and accent from Albedo, data slots from Slate. */
function accented(name: string, accent: string, bg: string, surface: string, line: string, text: string, dim: string): Theme {
  return { name, palette: { ...SLATE, accent, bg, surface, line, text, dim } };
}

/** Built-in themes, in the order the picker shows them. */
export const THEMES = {
  slate: { name: "Slate", palette: SLATE },
  light: {
    name: "Light",
    palette: {
      bg: "#f6f5f1",
      surface: "#ffffff",
      line: "#dedfd8",
      text: "#303a39",
      dim: "#666f6b",
      accent: "#29749f",
      done: "#39836d",
      partial: "#4e7ea2",
      series1: "#3e89b1",
      series2: "#b85724",
      good: "#087f5c",
      bad: "#bd303b",
      warn: "#8f5f00",
    },
  },
  graphite: {
    name: "Graphite",
    palette: {
      bg: "#202327",
      surface: "#272b30",
      line: "#3c4249",
      text: "#c2c9d5",
      dim: "#929fb4",
      accent: "#6cb8de",
      done: "#39836d",
      partial: "#4e7ea2",
      series1: "#61abd1",
      series2: "#ee9867",
      good: "#52d7ae",
      bad: "#ff8790",
      warn: "#f0b429",
    },
  },
  orange: accented("Orange", "#ff7f00", "#0b0a08", "#14120e", "#2b261e", "#e8e4da", "#8a8377"),
  green: accented("Green", "#35d073", "#070b07", "#0e140e", "#1e2b21", "#e2ecdc", "#7f8f7d"),
  teal: accented("Teal", "#00e0c6", "#050a0a", "#0c1413", "#1c2a28", "#dcece9", "#7d918d"),
  purple: accented("Purple", "#b36bff", "#0a080e", "#130f19", "#272133", "#e9e2f2", "#91839e"),
  red: accented("Red", "#ff5436", "#0d0705", "#16100d", "#2d201a", "#f0e2dc", "#9e867c"),
  pink: accented("Pink", "#ff7fa8", "#080d14", "#0e1620", "#1d2836", "#ffc0cb", "#a8919c"),
  mono: accented("Mono", "#e8e8e8", "#0b0b0b", "#151515", "#2c2c2c", "#efefef", "#8f8f8f"),
} satisfies Record<string, Theme>;

export type PresetId = keyof typeof THEMES;
export const DEFAULT_PRESET: PresetId = "slate";
export const PRESET_IDS = Object.keys(THEMES) as PresetId[];

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => lin(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Whether a background is dark, which decides the page's color-scheme (scrollbars, native controls). */
export function isDark(bg: string): boolean {
  return luminance(bg) < 0.18;
}

/** Slots that carry text, which need 4.5:1 against the surface they sit on. */
export const TEXT_SLOTS: Slot[] = ["text", "dim", "accent", "good", "bad", "warn"];

// ---- Copy and paste ----

/** Versioned prefix of the text format themes are shared in. */
export const WIRE_PREFIX = "bytematch-theme:1:";
const ALBEDO_PREFIX = "albedo-theme:1:";

export function serializeTheme(theme: Theme): string {
  const palette = Object.fromEntries(SLOTS.map(({ slot }) => [slot, theme.palette[slot].toLowerCase()]));
  return `${WIRE_PREFIX}${JSON.stringify({ name: theme.name, palette })}`;
}

export type ParseResult = { ok: true; theme: Theme } | { ok: false; error: string };

/**
 * Read a shared theme. Accepts ByteMatch's format and Albedo's (`albedo-theme:1:`), whose twelve
 * slots map onto the neutrals, accent and states; ByteMatch's data slots then come from Slate.
 */
export function parseTheme(text: string): ParseResult {
  const t = text.trim();
  const albedo = t.startsWith(ALBEDO_PREFIX);
  if (!albedo && !t.startsWith(WIRE_PREFIX)) {
    return { ok: false, error: `Not a theme: it should start with ${WIRE_PREFIX}` };
  }
  let data: { name?: unknown; palette?: unknown };
  try {
    data = JSON.parse(t.slice(albedo ? ALBEDO_PREFIX.length : WIRE_PREFIX.length));
  } catch {
    return { ok: false, error: "The theme's JSON could not be read." };
  }
  const name = typeof data?.name === "string" ? data.name.trim().slice(0, 40) : "";
  if (!name) return { ok: false, error: "The theme has no name." };
  if (!data.palette || typeof data.palette !== "object") return { ok: false, error: "The theme has no palette." };
  const p = data.palette as Record<string, unknown>;

  const source: Record<Slot, string> = albedo
    ? ({
        bg: "bg",
        surface: "panel",
        line: "edge",
        text: "fg",
        dim: "dim",
        accent: "accent",
        good: "success",
        bad: "danger",
        warn: "warn",
      } as Record<Slot, string>)
    : (Object.fromEntries(SLOTS.map(({ slot }) => [slot, slot])) as Record<Slot, string>);
  const palette = { ...SLATE };
  for (const [slot, key] of Object.entries(source) as [Slot, string][]) {
    if (!isHex(p[key])) return { ok: false, error: `Slot "${key}" is not a colour like #1a2b3c.` };
    palette[slot] = (p[key] as string).toLowerCase();
  }
  return { ok: true, theme: { name, palette } };
}

// ---- Applying and remembering ----

/** What the browser remembers: which theme is chosen, and its palette so it can apply before paint. */
export interface Chosen {
  /** "preset:<id>" or "custom:<name>". */
  id: string;
  palette: Palette;
}

export const CHOSEN_KEY = "bytematch-theme";
export const CUSTOM_KEY = "bytematch-themes";
/** Fired on window when the chosen theme or the custom list changes in this tab. */
export const THEME_EVENT = "bytematch-theme";

/** Write a palette's slots onto <html>; null clears them so the stylesheet's Slate applies. */
export function applyTheme(palette: Palette | null) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  for (const { slot, css } of SLOTS) {
    if (palette && isHex(palette[slot])) style.setProperty(css, palette[slot]);
    else style.removeProperty(css);
  }
  style.colorScheme = palette ? (isDark(palette.bg) ? "dark" : "light") : "";
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
}

function json(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The remembered choice, from storage's raw text (pass it to parse a snapshot you already hold). */
export function chosenTheme(raw = readRaw(CHOSEN_KEY)): Chosen | null {
  const c = json(raw) as Chosen | null;
  return c && typeof c.id === "string" && c.palette && typeof c.palette === "object" ? c : null;
}

/** Saved custom themes, each re-checked by the same parser as a pasted theme. */
export function customThemes(raw = readRaw(CUSTOM_KEY)): Theme[] {
  const list = json(raw);
  if (!Array.isArray(list)) return [];
  return list.flatMap((t) => {
    const r = parseTheme(`${WIRE_PREFIX}${JSON.stringify(t)}`);
    return r.ok ? [r.theme] : [];
  });
}

/** Choose a theme: apply it now and remember it. The default preset is remembered as nothing. */
export function chooseTheme(id: string, palette: Palette) {
  const isDefault = id === `preset:${DEFAULT_PRESET}`;
  applyTheme(isDefault ? null : palette);
  write(CHOSEN_KEY, isDefault ? null : ({ id, palette } satisfies Chosen));
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function saveCustomThemes(list: Theme[]) {
  write(CUSTOM_KEY, list);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Runs in <head> before first paint: applies the remembered palette, so a chosen theme never
 * flashes Slate first. Kept dependency-free and small; it trusts only #rrggbb values.
 */
export const BOOT_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(CHOSEN_KEY)})||"null");if(!c||!c.palette)return;var m=${JSON.stringify(
  Object.fromEntries(SLOTS.map(({ slot, css }) => [slot, css])),
)},s=document.documentElement.style,p=c.palette,h=/^#[0-9a-fA-F]{6}$/;for(var k in m)if(h.test(p[k]))s.setProperty(m[k],p[k]);if(h.test(p.bg)){var n=parseInt(p.bg.slice(1),16),l=function(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)};s.colorScheme=0.2126*l(n>>16&255)+0.7152*l(n>>8&255)+0.0722*l(n&255)<0.18?"dark":"light"}}catch(e){}})()`;
