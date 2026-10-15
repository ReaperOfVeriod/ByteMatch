import { describe, expect, it } from "vitest";
import { RenderCache } from "./render-cache";

describe("RenderCache", () => {
  it("renders each key once and drops the least recently used", async () => {
    const c = new RenderCache<number>(2);
    let renders = 0;
    const r = (n: number) => () => {
      renders++;
      return n;
    };
    expect(await c.getOrRender("a", r(1))).toBe(1);
    expect(await c.getOrRender("a", r(9))).toBe(1);
    expect(renders).toBe(1);
    await c.getOrRender("b", r(2));
    c.get("a"); // a is now the most recent
    await c.getOrRender("c", r(3)); // evicts b
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });
});
