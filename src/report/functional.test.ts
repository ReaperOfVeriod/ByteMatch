import { describe, expect, it } from "vitest";
import { FunctionalListError, parseFunctionalList, summarizeFunctional } from "./functional";
import { emptyMeasures, type Report } from "./types";

const enc = (s: string) => new TextEncoder().encode(s);
const fn = (name: string, size: number, fuzzy: number) => ({ name, size, fuzzy_match_percent: fuzzy });

const report: Report = {
  version: 2,
  measures: { ...emptyMeasures(), total_code: 1000 },
  categories: [{ id: "game", name: "Game", measures: { ...emptyMeasures(), total_code: 400 } }],
  units: [
    {
      name: "core/a",
      measures: emptyMeasures(),
      sections: [],
      functions: [fn("func_a", 100, 50), fn("func_b", 40, 100), fn("func_c", 60, 0)],
      metadata: { progress_categories: [] },
    },
    {
      name: "game/b",
      measures: emptyMeasures(),
      sections: [],
      functions: [fn("func_d", 200, 80)],
      metadata: { progress_categories: ["game"] },
    },
  ],
};

describe("parseFunctionalList", () => {
  it("reads rac1-decomp's TSV: names, comments, and a third column as confidence", () => {
    const list = parseFunctionalList(enc("# name\tfile\nfunc_a\tnonmatching/game/func_a.c\nfunc_c\tf.c\tHIGH\n\n"), "functional.tsv");
    expect([...list]).toEqual([
      ["func_a", "unrated"],
      ["func_c", "high"],
    ]);
  });

  it("reads JSON objects, a bare array, or plain names", () => {
    const obj = parseFunctionalList(
      enc('{"functions":[{"name":"func_a","confidence":"medium"},{"name":"func_d","confidence":"maybe"}]}'),
      "functional.json",
    );
    expect(Object.fromEntries(obj)).toEqual({ func_a: "medium", func_d: "unrated" });
    expect([...parseFunctionalList(enc('["func_a"]'), "functional.json").keys()]).toEqual(["func_a"]);
  });

  it("says what's wrong with a list it can't read", () => {
    expect(() => parseFunctionalList(enc("{"), "functional.json")).toThrow(FunctionalListError);
    expect(() => parseFunctionalList(enc('{"nope":1}'), "functional.json")).toThrow(/functions/);
  });
});

describe("summarizeFunctional", () => {
  it("counts listed functions that aren't matched, never the matched ones", () => {
    const list = new Map([
      ["func_a", "high" as const],
      ["func_b", "low" as const],
      ["func_d", "unrated" as const],
      ["func_gone", "high" as const],
    ]);
    const s = summarizeFunctional(report, list);
    expect(s).toMatchObject({ code: 300, code_percent: 30, functions: 2, listed: 4, already_matched: 1, not_found: 1 });
    expect(s.by_confidence.high).toEqual({ functions: 1, code: 100 });
    expect(s.by_confidence.unrated).toEqual({ functions: 1, code: 200 });
    expect(s.by_confidence.low).toEqual({ functions: 0, code: 0 });
    expect(s.categories.game).toEqual({ code: 200, functions: 1, code_percent: 50 });
  });

  it("leaves the report's own measures alone", () => {
    const before = JSON.stringify(report);
    summarizeFunctional(report, new Map([["func_a", "high"]]));
    expect(JSON.stringify(report)).toBe(before);
  });
});
