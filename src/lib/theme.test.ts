import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOT_SCRIPT,
  CHOSEN_KEY,
  contrast,
  isDark,
  parseTheme,
  PRESET_IDS,
  serializeTheme,
  SLOTS,
  TEXT_SLOTS,
  THEMES,
  type Palette,
} from "./theme";

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
    const r = parseTheme(serializeTheme(THEMES[id]));
    expect(r).toEqual({ ok: true, theme: THEMES[id] });
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
      theme: {
        name: "blue",
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
    expect(parseTheme("hello")).toMatchObject({ ok: false, error: expect.stringContaining("bytematch-theme:1:") });
    expect(parseTheme("bytematch-theme:1:{")).toMatchObject({ ok: false, error: expect.stringContaining("JSON") });
    expect(parseTheme('bytematch-theme:1:{"palette":{}}')).toMatchObject({ ok: false, error: expect.stringContaining("name") });
    const bad = { name: "x", palette: { ...THEMES.slate.palette, accent: "red" } };
    expect(parseTheme(`bytematch-theme:1:${JSON.stringify(bad)}`)).toMatchObject({ ok: false, error: expect.stringContaining('"accent"') });
  });
});

describe("BOOT_SCRIPT", () => {
  function run(stored: unknown) {
    const props: Record<string, string> = {};
    const style = { setProperty: (k: string, v: string) => (props[k] = v), colorScheme: "" };
    const env = {
      localStorage: { getItem: (k: string) => (k === CHOSEN_KEY ? JSON.stringify(stored) : null) },
      document: { documentElement: { style } },
    };
    new Function("localStorage", "document", BOOT_SCRIPT)(env.localStorage, env.document);
    return { props, scheme: style.colorScheme };
  }

  it("applies the remembered palette and its color-scheme", () => {
    const { props, scheme } = run({ id: "preset:light", palette: THEMES.light.palette });
    expect(props["--bg"]).toBe("#f6f5f1");
    expect(props["--text-3"]).toBe(THEMES.light.palette.dim);
    expect(Object.keys(props)).toHaveLength(SLOTS.length);
    expect(scheme).toBe("light");
  });

  it("skips anything that is not a hex colour", () => {
    const { props } = run({ id: "custom:x", palette: { ...THEMES.slate.palette, bg: "url(x)" } });
    expect(props["--bg"]).toBeUndefined();
    expect(props["--surface"]).toBe(THEMES.slate.palette.surface);
  });

  it("does nothing without a remembered theme", () => {
    expect(run(null).props).toEqual({});
  });
});
