import { existsSync } from "node:fs";

const tailwindStylesheet = "./src/app/globals.css";

/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = {
  printWidth: 140,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  trailingComma: "all",
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4 entry point for class sorting (resolved relative to this file).
  // prettier-plugin-tailwindcss 0.8 throws ENOENT and aborts formatting if this file
  // does not exist, so it is only set once the stylesheet is present. Until then the
  // plugin falls back to the default Tailwind theme for sorting.
  ...(existsSync(new URL(tailwindStylesheet, import.meta.url)) ? { tailwindStylesheet } : {}),
};

export default config;
