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

/**
 * The structural half of a theme: how the site is laid out and drawn, as opposed to its colours.
 * Like the palette it is a fixed set of slots; globals.css keys everything off them.
 */
export interface Style {
  /** Classic: sticky header, panels and a sidebar. Directory: a flat header, wide project cards
   *  and a report page with its details under the summary (after the redesign in PR #1). */
  layout: "classic" | "directory";
  corners: "round" | "soft" | "square";
  /** Raised: panels cast soft shadows and the page has a glow. Flat: borders only. */
  depth: "raised" | "flat";
  density: "comfortable" | "compact" | "roomy";
  font: "geist" | "system" | "mono";
}

export interface Theme {
  name: string;
  palette: Palette;
  style: Style;
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
function accented(name: string, accent: string, bg: string, surface: string, line: string, text: string, dim: string): ColourTheme {
  return { name, palette: { ...SLATE, accent, bg, surface, line, text, dim } };
}

type ColourTheme = Omit<Theme, "style">;

/** Built-in colour themes, in the order the picker shows them. */
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
} satisfies Record<string, ColourTheme>;

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

/** Each style slot's options, in the order editors offer them, with a label for each. */
export const STYLE_OPTIONS: { [K in keyof Style]: { label: string; options: { value: Style[K]; label: string }[] } } = {
  layout: {
    label: "Layout",
    options: [
      { value: "classic", label: "Classic" },
      { value: "directory", label: "Directory" },
    ],
  },
  corners: {
    label: "Corners",
    options: [
      { value: "round", label: "Round" },
      { value: "soft", label: "Soft" },
      { value: "square", label: "Square" },
    ],
  },
  depth: {
    label: "Depth",
    options: [
      { value: "raised", label: "Raised" },
      { value: "flat", label: "Flat" },
    ],
  },
  density: {
    label: "Spacing",
    options: [
      { value: "compact", label: "Compact" },
      { value: "comfortable", label: "Comfortable" },
      { value: "roomy", label: "Roomy" },
    ],
  },
  font: {
    label: "Font",
    options: [
      { value: "geist", label: "Geist" },
      { value: "system", label: "System" },
      { value: "mono", label: "Mono" },
    ],
  },
};

export const STYLE_KEYS = Object.keys(STYLE_OPTIONS) as (keyof Style)[];

/** Built-in styles. Classic is today's site; Directory is the redesign proposed in PR #1. */
export const STYLES = {
  classic: {
    name: "Classic",
    description: "Rounded panels, a sticky header and a details sidebar.",
    style: { layout: "classic", corners: "round", depth: "raised", density: "comfortable", font: "geist" },
  },
  directory: {
    name: "Directory",
    description: "Square and flat: wide project cards, big figures, details under the report.",
    style: { layout: "directory", corners: "square", depth: "flat", density: "comfortable", font: "geist" },
  },
  compact: {
    name: "Compact",
    description: "The classic layout, tighter and flatter, in your system's font.",
    style: { layout: "classic", corners: "soft", depth: "flat", density: "compact", font: "system" },
  },
  terminal: {
    name: "Terminal",
    description: "The directory layout, dense and monospaced.",
    style: { layout: "directory", corners: "square", depth: "flat", density: "compact", font: "mono" },
  },
} satisfies Record<string, { name: string; description: string; style: Style }>;

export type StyleId = keyof typeof STYLES;
export const DEFAULT_STYLE: StyleId = "classic";
export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

/** The built-in style a style equals, if any. */
export function styleId(style: Style): StyleId | null {
  return STYLE_IDS.find((id) => STYLE_KEYS.every((k) => STYLES[id].style[k] === style[k])) ?? null;
}

/** A style with every slot checked; anything unknown takes Classic's value. */
export function cleanStyle(raw: unknown): Style {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = STYLES.classic.style as Style;
  return Object.fromEntries(
    STYLE_KEYS.map((k) => [k, STYLE_OPTIONS[k].options.some((o) => o.value === r[k]) ? r[k] : base[k]]),
  ) as unknown as Style;
}

// ---- Copy and paste ----

/** Versioned prefix of the text format themes are shared in. Version 1 had no style. */
export const WIRE_PREFIX = "bytematch-theme:2:";
const WIRE_V1 = "bytematch-theme:1:";
const ALBEDO_PREFIX = "albedo-theme:1:";

export function serializeTheme(theme: Theme): string {
  const palette = Object.fromEntries(SLOTS.map(({ slot }) => [slot, theme.palette[slot].toLowerCase()]));
  return `${WIRE_PREFIX}${JSON.stringify({ name: theme.name, palette, style: theme.style })}`;
}

export type ParseResult = { ok: true; theme: Theme; from: "bytematch" | "albedo" } | { ok: false; error: string };

const ALBEDO_SLOTS: Partial<Record<Slot, string>> = {
  bg: "bg",
  surface: "panel",
  line: "edge",
  text: "fg",
  dim: "dim",
  accent: "accent",
  good: "success",
  bad: "danger",
  warn: "warn",
};

/**
 * Read a shared theme. Accepts ByteMatch's format (both versions) and Albedo's
 * (`albedo-theme:1:`), whose twelve slots map onto the neutrals, accent and states; ByteMatch's
 * data slots then come from Slate. A theme without a style gets Classic.
 */
export function parseTheme(text: string): ParseResult {
  const t = text.trim();
  if (!t) return { ok: false, error: "Paste a theme first." };
  const prefix = [WIRE_PREFIX, WIRE_V1, ALBEDO_PREFIX].find((p) => t.startsWith(p));
  if (!prefix) {
    return {
      ok: false,
      error: "That isn't a theme. A theme is one line starting with bytematch-theme: (or albedo-theme: from Albedo).",
    };
  }
  let data: { name?: unknown; palette?: unknown; style?: unknown };
  try {
    data = JSON.parse(t.slice(prefix.length));
  } catch {
    return { ok: false, error: "The theme looks cut off. Copy the whole line and paste it again." };
  }
  const name = typeof data?.name === "string" ? data.name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
  if (!name) return { ok: false, error: "The theme has no name." };
  if (!data.palette || typeof data.palette !== "object") return { ok: false, error: "The theme has no colours." };
  const p = data.palette as Record<string, unknown>;

  const albedo = prefix === ALBEDO_PREFIX;
  const source = albedo ? ALBEDO_SLOTS : Object.fromEntries(SLOTS.map(({ slot }) => [slot, slot]));
  const palette = { ...SLATE };
  for (const [slot, key] of Object.entries(source) as [Slot, string][]) {
    if (!isHex(p[key])) return { ok: false, error: `The colour "${key}" should look like #1a2b3c.` };
    palette[slot] = (p[key] as string).toLowerCase();
  }
  return { ok: true, theme: { name, palette, style: cleanStyle(data.style) }, from: albedo ? "albedo" : "bytematch" };
}

// ---- The chosen theme ----

/**
 * What a visitor has chosen. It lives in a cookie, so the server renders the right layout and
 * colours from the first byte; saved custom themes are larger and stay in localStorage.
 */
export interface Chosen {
  /** Which colours: "preset:<id>" or "custom:<name>". */
  colours: string;
  palette: Palette;
  style: Style;
}

export const CHOSEN_COOKIE = "bytematch-theme";
export const CUSTOM_KEY = "bytematch-themes";
/** Fired on window when the custom list changes in this tab. */
export const THEME_EVENT = "bytematch-themes";

export const DEFAULT_CHOSEN: Chosen = {
  colours: `preset:${DEFAULT_PRESET}`,
  palette: THEMES[DEFAULT_PRESET].palette,
  style: STYLES[DEFAULT_STYLE].style as Style,
};

/** The cookie's value: version, colours id, the thirteen hexes, the five style values. */
export function encodeChosen(c: Chosen): string {
  const hexes = SLOTS.map(({ slot }) => c.palette[slot].slice(1).toLowerCase()).join(",");
  const style = STYLE_KEYS.map((k) => c.style[k]).join(",");
  return encodeURIComponent(["2", c.colours, hexes, style].join("|"));
}

/** Read the cookie back; anything malformed means the default. Only hexes and known words pass. */
export function decodeChosen(raw: string | undefined | null): Chosen {
  if (!raw) return DEFAULT_CHOSEN;
  let v: string;
  try {
    v = decodeURIComponent(raw);
  } catch {
    return DEFAULT_CHOSEN;
  }
  const parts = v.split("|");
  if (parts.length < 4 || parts[0] !== "2") return DEFAULT_CHOSEN;
  const style = parts.pop()!;
  const hexes = parts.pop()!.split(",");
  const colours = parts.slice(1).join("|").slice(0, 60);
  if (hexes.length !== SLOTS.length || !hexes.every((h) => /^[0-9a-f]{6}$/i.test(h))) return DEFAULT_CHOSEN;
  const palette = Object.fromEntries(SLOTS.map(({ slot }, i) => [slot, `#${hexes[i].toLowerCase()}`])) as unknown as Palette;
  const values = style.split(",");
  return { colours, palette, style: cleanStyle(Object.fromEntries(STYLE_KEYS.map((k, i) => [k, values[i]]))) };
}

const isDefaultPalette = (p: Palette) => SLOTS.every(({ slot }) => p[slot] === THEMES[DEFAULT_PRESET].palette[slot]);

/** The CSS custom properties a palette sets on <html>; none for Slate, which the stylesheet has. */
export function paletteVars(palette: Palette): Record<string, string> {
  if (isDefaultPalette(palette)) return {};
  return {
    ...Object.fromEntries(SLOTS.map(({ slot, css }) => [css, palette[slot]])),
    colorScheme: isDark(palette.bg) ? "dark" : "light",
  };
}

/**
 * The data-* attributes a theme sets on <html>: one per style slot, and data-tinted when the
 * colours aren't Slate's (the header mark then takes the accent instead of the brand colours).
 */
export function themeAttrs(palette: Palette, style: Style): Record<string, string | undefined> {
  return {
    ...Object.fromEntries(STYLE_KEYS.map((k) => [`data-${k}`, style[k]])),
    "data-tinted": isDefaultPalette(palette) ? undefined : "",
  };
}
