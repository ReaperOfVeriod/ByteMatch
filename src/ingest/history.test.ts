import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";
import { history, storeReport } from "../db/store";
import { emptyMeasures } from "../report/types";
import { checkVersion, HistoryError, parseHistory, storeHistory } from "./history";

const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const entry = (sha: string, day: number, pct: number) => ({
  timestamp: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
  commit_sha: sha,
  commit_message: `commit ${sha}`,
  measures: { matched_code_percent: pct, total_code: 1000, matched_code: pct * 10 },
});

describe("history files", () => {
  it("reads decomp.dev's mode=history JSON, plain or gzipped", () => {
    const file = [entry("aaaaaaa", 2, 20), entry("bbbbbbb", 1, 10)];
    const rows = parseHistory(enc(file));
    expect(rows).toHaveLength(2);
    expect(rows[0].commit.sha).toBe("aaaaaaa");
    expect(rows[0].measures.matched_code_percent).toBe(20);
    expect(rows[0].measures.total_functions).toBe(0);
    expect(parseHistory(gzipSync(enc({ history: file })))).toHaveLength(2);
  });

  it("rejects what isn't a history file", () => {
    expect(() => parseHistory(enc({ nope: 1 }))).toThrow(HistoryError);
    expect(() => parseHistory(new TextEncoder().encode("<html>"))).toThrow(/not JSON/);
    expect(() => parseHistory(enc([{ ...entry("aaaaaaa", 1, 1), commit_sha: "../x" }]))).toThrow(/commit_sha/);
    expect(() => parseHistory(enc([{ ...entry("aaaaaaa", 1, 1), timestamp: "soon" }]))).toThrow(/timestamp/);
    expect(() => parseHistory(enc([]))).toThrow(/no history/);
  });

  it("checks version names", () => {
    expect(checkVersion(" GLMJ01 ")).toBe("GLMJ01");
    expect(checkVersion("SCES_509.16")).toBe("SCES_509.16");
    expect(checkVersion("a/b")).toBeNull();
    expect(checkVersion("")).toBeNull();
  });
});

describe.skipIf(!TEST_DB)("history storage and milestones", () => {
  useTestDb();

  it("fills gaps without replacing commits that have data", async () => {
    const p = await makeProject();
    const measures = { ...emptyMeasures(), matched_code_percent: 99 };
    await storeReport({
      project: p,
      version: "us",
      commit: { sha: "ccccccc", timestamp: new Date("2026-01-03") },
      report: { version: 2, measures, categories: [], units: [] },
      source: "artifact",
    });
    const rows = parseHistory(enc([entry("aaaaaaa", 1, 5), entry("bbbbbbb", 2, 30), entry("ccccccc", 3, 1)]));
    expect(await storeHistory(p, "us", rows)).toEqual({ added: 2, skipped: 1 });
    expect(await storeHistory(p, "us", rows)).toEqual({ added: 0, skipped: 3 });
    const h = await history(p.id, "us");
    expect(h.map((r) => r.measures.matched_code_percent)).toEqual([5, 30, 99]);
  });
});
