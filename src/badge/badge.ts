import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as opentype from "opentype.js";

/**
 * Shields-style badges, drawn here so they need no third-party service. Text is measured with
 * the bundled DejaVu Sans, which is also what the PNG renderer draws with, so both agree.
 */

export type BadgeStyle = "flat" | "flat-square" | "plastic" | "for-the-badge";

export interface BadgeInput {
  label: string;
  message: string;
  color?: string;
  labelColor?: string;
  style?: BadgeStyle;
}

const FONT_DIR = join(process.cwd(), "src/assets/fonts");
let regular: opentype.Font | undefined;
let bold: opentype.Font | undefined;

function font(weight: "regular" | "bold"): opentype.Font {
  if (weight === "bold") return (bold ??= parseFont("DejaVuSans-Bold.ttf"));
  return (regular ??= parseFont("DejaVuSans.ttf"));
}

function parseFont(file: string): opentype.Font {
  const data = readFileSync(join(FONT_DIR, file));
  return opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

export function fontPaths(): string[] {
  return [join(FONT_DIR, "DejaVuSans.ttf"), join(FONT_DIR, "DejaVuSans-Bold.ttf")];
}

/** Advance width of TEXT at SIZE px, plus LETTER spacing per glyph. */
export function textWidth(text: string, size: number, weight: "regular" | "bold" = "regular", letter = 0): number {
  // Glyph advances plus pair kerning; opentype.js's whole-string path trips over DejaVu's GSUB tables.
  const f = font(weight);
  const scale = size / f.unitsPerEm;
  let width = 0;
  let previous: opentype.Glyph | undefined;
  for (const ch of text) {
    const glyph = f.charToGlyph(ch);
    if (previous) width += f.getKerningValue(previous, glyph) * scale;
    width += (glyph.advanceWidth ?? 0) * scale + letter;
    previous = glyph;
  }
  return width;
}

/** shields.io's named colours; anything else must be a 3- or 6-digit hex value. */
const NAMED: Record<string, string> = {
  brightgreen: "#4c1",
  green: "#97ca00",
  yellowgreen: "#a4a61d",
  yellow: "#dfb317",
  orange: "#fe7d37",
  red: "#e05d44",
  blue: "#007ec6",
  grey: "#555",
  gray: "#555",
  lightgrey: "#9f9f9f",
  lightgray: "#9f9f9f",
  success: "#4c1",
  important: "#fe7d37",
  critical: "#e05d44",
  informational: "#007ec6",
  inactive: "#9f9f9f",
};

export function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const c = color.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  const hex = c.replace(/^#/, "");
  return /^([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex) ? `#${hex}` : fallback;
}

/** Badge styles by any spelling decomp.dev accepted: Flat, flat-square, FlatSquare, for_the_badge... */
export function parseStyle(value: string | null | undefined): BadgeStyle | undefined {
  if (!value) return "flat";
  switch (value.toLowerCase().replace(/[-_\s]/g, "")) {
    case "flat":
    case "social":
      return "flat";
    case "flatsquare":
      return "flat-square";
    case "plastic":
      return "plastic";
    case "forthebadge":
      return "for-the-badge";
    default:
      return undefined;
  }
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Light text on dark backgrounds, dark text on light ones (relative luminance, as shields does). */
function textColors(background: string): { fill: string; shadow: string } {
  const hex = background.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.5 ? { fill: "#333", shadow: "#ccc" } : { fill: "#fff", shadow: "#010101" };
}

export function renderBadge(input: BadgeInput): string {
  const style = input.style ?? "flat";
  const labelColor = resolveColor(input.labelColor, "#555");
  const color = resolveColor(input.color, "#007ec6");
  const big = style === "for-the-badge";
  const label = big ? input.label.toUpperCase() : input.label;
  const message = big ? input.message.toUpperCase() : input.message;
  const size = big ? 10 : 11;
  const height = big ? 28 : 20;
  const pad = big ? 12 : 5;
  const letter = big ? 1.25 : 0;
  const hasLabel = label.length > 0;
  const lw = hasLabel ? Math.round(textWidth(label, size, "regular", letter)) + pad * 2 : 0;
  const mw = Math.round(textWidth(message, size, big ? "bold" : "regular", letter)) + pad * 2;
  const width = lw + mw;
  const baseline = big ? 17.5 : 14;
  const radius = style === "flat" ? 3 : style === "plastic" ? 4 : 0;
  const shadow = style === "flat" || style === "plastic";
  const title = escape(hasLabel ? `${input.label}: ${input.message}` : input.message);
  const id = Math.abs(hash(`${style}|${label}|${message}|${color}|${labelColor}`)).toString(36);

  const text = (x: number, value: string, bg: string, weight: "regular" | "bold") => {
    const c = textColors(bg);
    const attrs = `x="${x}" text-anchor="middle" font-size="${size}"${letter ? ` letter-spacing="${letter}"` : ""}${weight === "bold" ? ' font-weight="bold"' : ""}`;
    const v = escape(value);
    return (
      (shadow ? `<text ${attrs} y="${baseline + 1}" fill="${c.shadow}" fill-opacity=".3">${v}</text>` : "") +
      `<text ${attrs} y="${baseline}" fill="${c.fill}">${v}</text>`
    );
  };

  const gradient =
    style === "plastic"
      ? `<linearGradient id="g${id}" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".1" stop-color="#aaa" stop-opacity=".1"/><stop offset=".9" stop-opacity=".3"/><stop offset="1" stop-opacity=".5"/></linearGradient>`
      : style === "flat"
        ? `<linearGradient id="g${id}" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`
        : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    gradient,
    `<clipPath id="c${id}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#c${id})">`,
    hasLabel ? `<rect width="${lw}" height="${height}" fill="${labelColor}"/>` : "",
    `<rect x="${lw}" width="${mw}" height="${height}" fill="${color}"/>`,
    gradient ? `<rect width="${width}" height="${height}" fill="url(#g${id})"/>` : "",
    `</g>`,
    `<g font-family="DejaVu Sans,Verdana,Geneva,sans-serif" text-rendering="geometricPrecision">`,
    hasLabel ? text(lw / 2, label, labelColor, "regular") : "",
    text(lw + mw / 2, message, color, big ? "bold" : "regular"),
    `</g>`,
    `</svg>`,
  ].join("");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** shields.io's endpoint format, for `https://img.shields.io/endpoint?url=...`. */
export function shieldsEndpoint(input: BadgeInput) {
  return { schemaVersion: 1, label: input.label, message: input.message, color: input.color ?? "informational" };
}
