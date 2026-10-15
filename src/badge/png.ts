import { Resvg } from "@resvg/resvg-js";
import { RenderCache } from "../lib/render-cache";
import { fontPaths } from "./badge";

const cache = new RenderCache<Uint8Array>(500);

/**
 * A badge SVG as PNG at twice its size (sharp on high-density screens), drawn with the bundled font.
 * The same SVG always makes the same PNG, so it's drawn once and kept (src/lib/render-cache.ts).
 */
export function badgePng(svg: string): Uint8Array {
  const hit = cache.get(svg);
  if (hit) return hit;
  const png = drawPng(svg);
  cache.set(svg, png);
  return png;
}

function drawPng(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: 2 },
    font: { loadSystemFonts: false, fontFiles: fontPaths(), defaultFontFamily: "DejaVu Sans" },
  });
  return resvg.render().asPng();
}
