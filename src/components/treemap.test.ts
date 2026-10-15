import { describe, expect, it } from "vitest";
import { grouped, ordered, squarify } from "./treemap";

describe("squarify", () => {
  const values = [6, 6, 4, 3, 2, 2, 1, 0];
  const rects = squarify(values, (v) => v, 600, 400);

  it("gives each item an area proportional to its value and drops zeros", () => {
    expect(rects).toHaveLength(7);
    const scale = (600 * 400) / 24;
    for (const r of rects) expect(r.w * r.h).toBeCloseTo(r.item * scale, 6);
  });

  it("stays inside the box without overlaps", () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-9);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(overlapW > 1e-6 && overlapH > 1e-6).toBe(false);
      }
  });

  it("keeps tiles reasonably square", () => {
    const worst = Math.max(...rects.map((r) => Math.max(r.w / r.h, r.h / r.w)));
    expect(worst).toBeLessThan(3);
  });
});

describe("ordered and grouped layouts", () => {
  const items = [5, 1, 1, 8, 2, 3];
  it("keeps list order, fills the box and gives proportional areas", () => {
    const rects = ordered(items, (v) => v, 400, 300);
    expect(rects.map((r) => r.item)).toEqual(items);
    const scale = (400 * 300) / 20;
    for (const r of rects) expect(r.w * r.h).toBeCloseTo(r.item * scale, 6);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const ow = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ow > 1e-6 && oh > 1e-6).toBe(false);
      }
  });

  it("groups by path and keeps each group in one box", () => {
    const units = [
      { name: "core/a", v: 4 },
      { name: "core/b", v: 4 },
      { name: "levels/l00/x", v: 2 },
      { name: "levels/l01/y", v: 6 },
      { name: "main", v: 4 },
    ];
    const { tiles, groups } = grouped(
      units,
      (u) => u.name,
      (u) => u.v,
      200,
      100,
    );
    expect(tiles).toHaveLength(5);
    const area = tiles.reduce((n, t) => n + t.w * t.h, 0);
    expect(area).toBeCloseTo(200 * 100, 6);
    const core = groups.find((g) => g.item === "core")!;
    for (const t of tiles.filter((t) => t.item.name.startsWith("core/"))) {
      expect(t.x).toBeGreaterThanOrEqual(core.x - 1e-9);
      expect(t.x + t.w).toBeLessThanOrEqual(core.x + core.w + 1e-9);
    }
    expect(groups.map((g) => g.item).sort()).toEqual(["core", "levels", "levels/l00", "levels/l01"].sort());
  });
});
