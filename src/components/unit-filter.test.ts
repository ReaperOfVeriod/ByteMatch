import { describe, expect, it } from "vitest";
import { parseUnitFilter } from "./unit-filter";

const units = [
  { name: "game/camera", totalCode: 20 * 1024, matchedCodePercent: 50 },
  { name: "game/camera_util", totalCode: 4 * 1024, matchedCodePercent: 50 },
  { name: "game/hero", totalCode: 64 * 1024, matchedCodePercent: 90 },
  { name: "core/libc", totalCode: 512, matchedCodePercent: 100 },
];
const names = (q: string) => units.filter(parseUnitFilter(q)).map((u) => u.name);

describe("parseUnitFilter", () => {
  it("combines name, percent and size terms", () => {
    expect(names("camera <70% >10kb")).toEqual(["game/camera"]);
    expect(names(">=90%")).toEqual(["game/hero", "core/libc"]);
    expect(names("<1kb")).toEqual(["core/libc"]);
    expect(names("GAME")).toHaveLength(3);
    expect(names("")).toHaveLength(4);
  });
});
