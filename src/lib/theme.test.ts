import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeCode,
  cleanStyle,
  contrast,
  decodeChosen,
  DEFAULT_CHOSEN,
  encodeChosen,
  paletteVars,
  STYLE_IDS,
  STYLES,
  themeAttrs,
  styleId,
  isDark,
  parseTheme,
  PRESET_IDS,
  serializeTheme,
  SLOTS,
  TEXT_SLOTS,
  THEMES,
  type Palette,
  type Theme,
} from "./theme";

const classic = STYLES.classic.style as Theme["style"];
const withStyle = (id: keyof typeof THEMES, style = classic): Theme => ({ ...THEMES[id], style });

describe("theme presets", () => {
  it("Slate equals the stylesheet's :root slots", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    for (const { slot, css: prop } of SLOTS) {
      const m = new RegExp(`\\n\\s*${prop}:\\s*(#[0-9a-f]{6});`).exec(root);
      expect(m?.[1], prop).toBe(THEMES.slate.palette[slot]);
    }
  });

  it.each(PRESET_IDS)("%s fills every slot with a hex colour", (id) => {
    const p: Palette = THEMES[id].palette;
    for (const { slot } of SLOTS) expect(p[slot]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(PRESET_IDS)("%s keeps text readable on its surfaces", (id) => {
    const p: Palette = THEMES[id].palette;
    for (const fg of TEXT_SLOTS.map((s) => p[s])) {
      expect(contrast(fg, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, p.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("knows which presets are light", () => {
    expect(PRESET_IDS.filter((id) => !isDark(THEMES[id].palette.bg))).toEqual(["light"]);
  });
});

describe("parseTheme", () => {
  it.each(PRESET_IDS)("round-trips %s", (id) => {
    const theme = withStyle(id, STYLES.directory.style as Theme["style"]);
    expect(parseTheme(serializeTheme(theme))).toEqual({ ok: true, theme, from: "bytematch" });
  });

  it("reads version 1 themes, which had no style, as Classic", () => {
    const v1 = `bytematch-theme:1:${JSON.stringify({ name: "Old", palette: THEMES.light.palette })}`;
    expect(parseTheme(v1)).toEqual({ ok: true, theme: { name: "Old", palette: THEMES.light.palette, style: classic }, from: "bytematch" });
  });

  it("keeps known style values and replaces unknown ones", () => {
    expect(cleanStyle({ layout: "directory", corners: "blobby", font: "mono" })).toEqual({ ...classic, layout: "directory", font: "mono" });
  });

  it("imports an Albedo theme onto Slate's data colours", () => {
    const albedo = {
      name: "blue",
      palette: {
        accent: "#00b3ff",
        accent2: "#ff7f00",
        bg: "#06080c",
        panel: "#0d1117",
        edge: "#1d2630",
        fg: "#dde6ec",
        dim: "#7d8b96",
        success: "#35d073",
        warn: "#ffb400",
        danger: "#ff5436",
        info: "#00b3ff",
        exo: "#a3ff5e",
      },
    };
    const r = parseTheme(`albedo-theme:1:${JSON.stringify(albedo)}`);
    expect(r).toEqual({
      ok: true,
      from: "albedo",
      theme: {
        name: "blue",
        style: classic,
        palette: {
          ...THEMES.slate.palette,
          accent: "#00b3ff",
          bg: "#06080c",
          surface: "#0d1117",
          line: "#1d2630",
          text: "#dde6ec",
          dim: "#7d8b96",
          good: "#35d073",
          warn: "#ffb400",
          bad: "#ff5436",
        },
      },
    });
  });

  it("explains what is wrong", () => {
    expect(parseTheme("")).toMatchObject({ ok: false, error: expect.stringContaining("Paste") });
    expect(parseTheme("hello")).toMatchObject({ ok: false, error: expect.stringContaining("bytematch-theme:") });
    expect(parseTheme("bytematch-theme:2:{")).toMatchObject({ ok: false, error: expect.stringContaining("cut off") });
    expect(parseTheme('bytematch-theme:2:{"palette":{}}')).toMatchObject({ ok: false, error: expect.stringContaining("name") });
    const bad = { name: "x", palette: { ...THEMES.slate.palette, accent: "red" } };
    expect(parseTheme(`bytematch-theme:2:${JSON.stringify(bad)}`)).toMatchObject({ ok: false, error: expect.stringContaining('"accent"') });
  });
});

describe("styles", () => {
  it.each(STYLE_IDS)("%s is recognised as itself", (id) => {
    expect(styleId(STYLES[id].style as Theme["style"])).toBe(id);
  });

  it("names an adjusted style as none of the built-ins", () => {
    expect(styleId({ ...classic, density: "roomy" })).toBeNull();
  });

  it("sets one data attribute per style slot, and data-tinted off Slate", () => {
    expect(themeAttrs(THEMES.light.palette, classic)["data-tinted"]).toBe("");
    expect(themeAttrs(THEMES.slate.palette, classic)).toEqual({
      "data-tinted": undefined,
      "data-layout": "classic",
      "data-corners": "round",
      "data-depth": "raised",
      "data-density": "comfortable",
      "data-font": "geist",
    });
  });
});

describe("the theme cookie", () => {
  it("round-trips colours, palette and style, including custom names", () => {
    const c = { colours: "custom:Dusk | v2 ☾", palette: THEMES.pink.palette, style: STYLES.terminal.style as Theme["style"] };
    expect(decodeChosen(encodeChosen(c))).toEqual(c);
  });

  it("falls back to the default for anything malformed", () => {
    for (const raw of [undefined, "", "%E0%A4%A", "1|x|y|z", encodeURIComponent("2|preset:x|zzzzzz|classic")]) {
      expect(decodeChosen(raw)).toEqual(DEFAULT_CHOSEN);
    }
  });

  it("lets only hex colours into the page's style attribute", () => {
    const hexes = SLOTS.map(() => "0b0f17").join(",");
    const injected = encodeURIComponent(`2|preset:x|${hexes.replace("0b0f17", "red;}")}|classic,round,raised,comfortable,geist`);
    expect(decodeChosen(injected)).toEqual(DEFAULT_CHOSEN);
  });

  it("writes no custom properties for Slate, and the color-scheme for others", () => {
    expect(paletteVars(THEMES.slate.palette)).toEqual({});
    expect(paletteVars(THEMES.light.palette)).toMatchObject({ "--bg": "#f6f5f1", colorScheme: "light" });
  });
});

describe("share codes", () => {
  it("reads codes however they're typed or pasted", () => {
    for (const input of [
      "brave-otter-12",
      " Brave Otter 12 ",
      "#brave-otter-12",
      "brave_otter_12",
      "https://bytematch.dev/theme/brave-otter-12?x=1",
    ]) {
      expect(normalizeCode(input)).toBe("brave-otter-12");
    }
  });

  it("rejects anything that isn't a code", () => {
    for (const input of ["", "brave-otter", "brave-otter-1", "brave-otter-123", "brave-otter-12; drop", "../x-y-12"]) {
      expect(normalizeCode(input)).toBeNull();
    }
  });
});
