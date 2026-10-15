import { Resvg } from "@resvg/resvg-js";
import { fontPaths } from "./badge";

/** A badge SVG as PNG at twice its size (sharp on high-density screens), drawn with the bundled font. */
export function badgePng(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: 2 },
    font: { loadSystemFonts: false, fontFiles: fontPaths(), defaultFontFamily: "DejaVu Sans" },
  });
  return resvg.render().asPng();
}
