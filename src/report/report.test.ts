import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reportChanges, summarizeFunctions } from "./changes";
import { BADGE_MEASURES, formatBytes, formatMeasure, sumMeasures } from "./measures";
import { encodeReport, parseReport, ReportError, splitReport } from "./parse";

const fixture = readFileSync(new URL("../../test/fixtures/report-v2.json", import.meta.url));

describe("parseReport", () => {
  it("reads objdiff JSON with 64-bit numbers as strings", () => {
    const r = parseReport(fixture);
    expect(r.version).toBe(2);
    expect(r.measures.total_code).toBe(3712808);
    expect(r.measures.matched_functions).toBe(4520);
    expect(r.units[0].name).toBe("core/00112380");
    expect(r.units[0].functions[0]).toMatchObject({ name: "func_00112380", size: 40, metadata: { virtual_address: 1123200 } });
    expect(r.units[0].metadata?.progress_categories).toEqual(["executable", "game"]);
  });

  it("round-trips through binary protobuf", () => {
    const r = parseReport(fixture);
    const back = parseReport(encodeReport(r));
    expect(back.measures).toEqual(r.measures);
    expect(back.units.map((u) => u.name)).toEqual(r.units.map((u) => u.name));
    expect(back.units[0].functions[1]).toEqual(r.units[0].functions[1]);
    expect(back.categories.map((c) => c.id)).toEqual(r.categories.map((c) => c.id));
  });

  it("accepts the protobuf canonical JSON field names", () => {
    const r = parseReport(
      JSON.stringify({ version: 2, measures: { totalCode: "10", matchedCode: "5", matchedCodePercent: 50 }, units: [] }),
    );
    expect(r.measures.total_code).toBe(10);
    expect(r.measures.matched_code_percent).toBe(50);
  });

  it("migrates objdiff's legacy JSON to version 2", () => {
    const legacy = {
      fuzzy_match_percent: 50,
      total_code: 300,
      matched_code: 100,
      matched_code_percent: 33.3,
      total_data: 0,
      matched_data: 0,
      matched_data_percent: 100,
      total_functions: 3,
      matched_functions: 1,
      matched_functions_percent: 33.3,
      units: [
        {
          name: "main/a",
          fuzzy_match_percent: 100,
          total_code: 100,
          matched_code: 100,
          total_data: 0,
          matched_data: 0,
          total_functions: 1,
          matched_functions: 1,
          complete: true,
          sections: [],
          functions: [{ name: "a", size: 100, fuzzy_match_percent: 100, address: "0x80003100" }],
        },
        {
          name: "rel/b",
          fuzzy_match_percent: 25,
          total_code: 200,
          matched_code: 0,
          total_data: 0,
          matched_data: 0,
          total_functions: 2,
          matched_functions: 0,
          module_name: "b",
          module_id: 1,
          sections: [],
          functions: [],
        },
      ],
    };
    const r = parseReport(JSON.stringify(legacy));
    expect(r.version).toBe(2);
    expect(r.measures.complete_code).toBe(100);
    expect(r.measures.total_units).toBe(2);
    expect(r.measures.complete_units).toBe(1);
    expect(r.units[0].functions[0].metadata?.virtual_address).toBe(0x80003100);
    expect(r.categories.map((c) => c.id).sort()).toEqual(["dol", "modules"]);
    const dol = r.categories.find((c) => c.id === "dol")!;
    expect(dol.measures.total_code).toBe(100);
    expect(dol.measures.complete_units).toBe(1);
  });

  it("rejects what is not a report", () => {
    expect(() => parseReport("")).toThrow(ReportError);
    expect(() => parseReport("{not json")).toThrow(ReportError);
    expect(() => parseReport(JSON.stringify({ version: 9, measures: {} }))).toThrow(/unsupported report version/);
  });
});

describe("measures", () => {
  it("sums like objdiff: fuzzy weighted by code, empty totals at 100%", () => {
    const r = parseReport(fixture);
    const sum = sumMeasures(r.units.map((u) => u.measures));
    expect(sum.total_code).toBe(r.units.reduce((n, u) => n + u.measures.total_code, 0));
    expect(sum.matched_data_percent).toBe(100);
  });

  it("formats badge messages like decomp.dev did", () => {
    const m = parseReport(fixture).measures;
    expect(formatMeasure(m, BADGE_MEASURES.matched_code_percent)).toBe("86.02%");
    expect(formatMeasure(m, BADGE_MEASURES.matched_code)).toBe("86.02%");
    expect(formatMeasure(m, BADGE_MEASURES.matched_functions)).toBe("4,520 / 5,109");
    expect(formatMeasure(m, BADGE_MEASURES.complete_units)).toBe("89 / 141");
    expect(formatBytes(3712808)).toBe("3.71 MB");
  });
});

describe("splitReport", () => {
  it("splits a multi-version report on its top-level categories", () => {
    const r = parseReport(fixture);
    r.categories = [
      { id: "GAMEA", name: "A", measures: r.measures },
      { id: "GAMEA.game", name: "Game", measures: r.measures },
      { id: "GAMEB", name: "B", measures: r.measures },
    ];
    r.units[0].name = "GAMEA/core/x";
    r.units[0].metadata!.progress_categories = ["GAMEA", "GAMEA.game"];
    r.units[1].metadata!.progress_categories = ["GAMEB"];
    const parts = splitReport(r);
    expect([...parts.keys()]).toEqual(["GAMEA", "GAMEB"]);
    expect(parts.get("GAMEA")!.units[0].name).toBe("core/x");
    expect(parts.get("GAMEA")!.units[0].metadata?.progress_categories).toEqual(["game"]);
    expect(parts.get("GAMEA")!.categories.map((c) => c.id)).toEqual(["game"]);
    expect(parts.get("GAMEB")!.units).toHaveLength(1);
  });
});

describe("reportChanges", () => {
  it("lists newly matched and regressed functions", () => {
    const before = parseReport(fixture);
    const after = parseReport(fixture);
    const unit = after.units[1];
    const [f0] = unit.functions;
    const old = before.units[1].functions[0];
    old.fuzzy_match_percent = 90;
    before.units[1].measures.matched_functions -= 1;
    f0.fuzzy_match_percent = 100;
    after.units[2].functions[0].fuzzy_match_percent = 50;
    after.units[2].measures.matched_functions -= 1;
    const changes = reportChanges(before, after);
    expect(changes.units.map((u) => u.name)).toEqual([after.units[1].name, after.units[2].name]);
    const s = summarizeFunctions(changes);
    expect(s.newlyMatched.map((f) => f.name)).toEqual([f0.name]);
    expect(s.regressed.map((f) => f.name)).toEqual([after.units[2].functions[0].name]);
  });
});
