// Builds src/app/favicon.ico and src/app/apple-icon.png from src/app/icon.svg.
// An .ico may hold PNG images directly, so this only renders PNGs and writes the ICO directory.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("src/app/icon.svg", "utf8");
const png = (size, background) => new Resvg(svg, { fitTo: { mode: "width", value: size }, background }).render().asPng();

const sizes = [16, 32, 48];
const images = sizes.map((s) => png(s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(s, at); // width
  header.writeUInt8(s, at + 1); // height
  header.writeUInt8(0, at + 2); // palette
  header.writeUInt8(0, at + 3);
  header.writeUInt16LE(1, at + 4); // planes
  header.writeUInt16LE(32, at + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...images]));

// Apple touch icon: iOS adds its own rounding, so no transparent corners.
const apple = svg.replace('rx="14" fill="#0b0f17"', 'fill="#0b0f17"');
writeFileSync("src/app/apple-icon.png", new Resvg(apple, { fitTo: { mode: "width", value: 180 } }).render().asPng());
console.log("favicon.ico", sizes.join("/"), "and apple-icon.png written");
