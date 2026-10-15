import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Shared pieces of the social cards (opengraph-image routes), drawn with next/og's ImageResponse. */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  bg: "#0b0f17",
  surface: "#111723",
  line: "#253047",
  text: "#e6ecf5",
  text2: "#aab6c9",
  text3: "#8592a8",
  accent: "#5b9cf5",
  done: "#2f9e44",
  partial: "#2563b8",
  idle: "#343c4b",
  track: "#1f2939",
};

type Font = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };

const FONT_FILES: [name: string, file: string, weight: Font["weight"]][] = [
  ["Geist", "geist-sans/Geist-Regular.ttf", 400],
  ["Geist", "geist-sans/Geist-SemiBold.ttf", 600],
  ["Geist Mono", "geist-mono/GeistMono-Medium.ttf", 500],
  ["Geist Mono", "geist-mono/GeistMono-SemiBold.ttf", 600],
];

let fonts: Promise<Font[]> | undefined;

/**
 * Geist, read from the geist package (static TTFs: Satori takes neither variable fonts nor woff2).
 * If the files are missing (e.g. not traced into a deployment), the cards fall back to next/og's
 * default font instead of failing.
 */
export function ogFonts(): Promise<Font[]> {
  return (fonts ??= (async () => {
    const dir = join(process.cwd(), "node_modules/geist/dist/fonts");
    try {
      return await Promise.all(
        FONT_FILES.map(async ([name, file, weight]) => ({ name, data: await readFile(join(dir, file)), weight, style: "normal" as const })),
      );
    } catch (e) {
      console.warn("og: Geist fonts unavailable, using the default font:", e instanceof Error ? e.message : e);
      return [];
    }
  })());
}

export const SANS = "Geist, sans-serif";
export const MONO = "'Geist Mono', monospace";

/** Deterministic 0..1 noise so the motif is the same on every render. */
function noise(i: number, seed: number) {
  let x = (i + 1) * 374761393 + seed * 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

/**
 * A field of unit squares, as on a project's unit map: green (matched), blue (started), slate (untouched).
 * `progress` (0..1) biases the mix towards green.
 */
export function UnitGrid({
  cols,
  rows,
  cell = 26,
  gap = 6,
  progress = 0.6,
  seed = 7,
  fade = true,
}: {
  cols: number;
  rows: number;
  cell?: number;
  gap?: number;
  progress?: number;
  seed?: number;
  fade?: boolean;
}) {
  const squares = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const n = noise(i, seed);
      const color = n < progress ? OG.done : n < progress + 0.14 ? OG.partial : OG.idle;
      // Fades out towards the left edge so it sits behind the text.
      const opacity = fade ? 0.18 + 0.72 * (c / Math.max(1, cols - 1)) : 0.9;
      squares.push(
        <div
          key={i}
          style={{ width: cell, height: cell, borderRadius: 4, background: color, opacity, marginRight: gap, marginBottom: gap }}
        />,
      );
    }
  }
  return <div style={{ display: "flex", flexWrap: "wrap", width: cols * (cell + gap) }}>{squares}</div>;
}

/** The site's mark (as in the layout header: four units, three matched) and the wordmark. */
export function Wordmark({ name, size = 30, color = OG.text }: { name: string; size?: number; color?: string }) {
  const k = (size * 0.95) / 20;
  const rect = (x: number, y: number, w: number, h: number, r: number, fill: string) => (
    <div style={{ position: "absolute", left: x * k, top: y * k, width: w * k, height: h * k, borderRadius: r * k, background: fill }} />
  );
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", position: "relative", width: 20 * k, height: 20 * k, marginRight: Math.round(size * 0.4) }}>
        {rect(1, 1, 11, 11, 2.5, OG.done)}
        {rect(13.5, 1, 5.5, 5.5, 1.5, OG.done)}
        {rect(13.5, 8, 5.5, 11, 1.5, OG.partial)}
        {rect(1, 13.5, 11, 5.5, 1.5, OG.done)}
      </div>
      <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: size, color, letterSpacing: -0.5 }}>{name}</div>
    </div>
  );
}
