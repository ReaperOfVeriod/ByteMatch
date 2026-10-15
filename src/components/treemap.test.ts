import { describe, expect, it } from "vitest";
import { squarify } from "./treemap";

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
