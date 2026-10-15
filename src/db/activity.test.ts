import { describe, expect, it } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";
import { parseHistory, storeHistory } from "../ingest/history";
import { milestones } from "./store";

const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const entry = (sha: string, day: number, pct: number) => ({
  timestamp: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
  commit_sha: sha,
  measures: { matched_code_percent: pct },
});

describe.skipIf(!TEST_DB)("activity", () => {
  useTestDb();

  it("finds the first commit past each threshold, highest per commit", async () => {
    const p = await makeProject({ name: "RAC" });
    await storeHistory(
      p,
      "us",
      parseHistory(enc([entry("aaaaaaa", 1, 5), entry("bbbbbbb", 2, 30), entry("ccccccc", 3, 20), entry("ddddddd", 4, 52)])),
    );
    const list = await milestones();
    expect(list.map((m) => [m.commit_sha, m.threshold])).toEqual([
      ["ddddddd", 50],
      ["bbbbbbb", 25],
    ]);
  });
});
