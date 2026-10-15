import { describe, expect, it } from "vitest";
import { explain, problemCode } from "./problems";

describe("problemCode", () => {
  it.each([
    ["artifact has several files and none is report.json: build/GUNE5D/config.json, objdiff.json", "no-report-file"],
    ["artifact is empty", "artifact-empty"],
    ["artifact unpacks to more than 104857600 bytes", "artifact-too-big"],
    ["report could not be parsed: invalid wire type", "report-unreadable"],
    ["No GitHub access to OpenRAC/rac1-decomp", "no-access"],
    ["API rate limit exceeded for user [id]", "rate-limited"],
    ["decomp.dev answered 502", "decompdev"],
    ["socket hang up", "unknown"],
  ])("%s → %s", (message, code) => {
    expect(problemCode(message)).toBe(code);
  });
});

describe("explain", () => {
  it("names the artifact and its files, and says what objdiff.json is", () => {
    const e = explain("no-report-file", { files: ["build/GUNE5D/config.json", "objdiff.json"] }, { artifact: "GUNE5D_report" });
    expect(e.what).toContain("“GUNE5D_report”");
    expect(e.what).toContain("“build/GUNE5D/config.json”");
    expect(e.fix[0]).toMatch(/objdiff.json is objdiff's project configuration/);
    expect(e.fix.join(" ")).toMatch(/objdiff-cli report generate/);
  });

  it("has a title and at least one step for every problem", () => {
    for (const code of [
      "no-report-file",
      "artifact-empty",
      "artifact-too-big",
      "report-unreadable",
      "no-access",
      "rate-limited",
      "decompdev",
      "unknown",
    ] as const) {
      const e = explain(code);
      expect(e.title.length).toBeGreaterThan(5);
      expect(e.fix.length).toBeGreaterThan(0);
    }
  });
});
