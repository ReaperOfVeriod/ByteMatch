import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";
import { parseReport } from "../report/parse";
import {
  defaultVersion,
  findProject,
  history,
  latestReport,
  loadReport,
  projectIndex,
  pruneReports,
  storeMeasuresOnly,
  storeReport,
} from "./store";

const report = () => parseReport(readFileSync(new URL("../../test/fixtures/report-v2.json", import.meta.url)));

describe.skipIf(!TEST_DB)("store", () => {
  useTestDb();

  it("stores, dedupes and reloads full reports", async () => {
    const p = await makeProject();
    const a = await storeReport({
      project: p,
      version: "SCES_509.16",
      commit: { sha: "a", timestamp: new Date("2026-10-01") },
      report: report(),
      source: "artifact",
      runId: 1,
    });
    const b = await storeReport({
      project: p,
      version: "SCES_509.16",
      commit: { sha: "b", timestamp: new Date("2026-10-02") },
      report: report(),
      source: "artifact",
      runId: 2,
    });
    expect(a.blobId).toBe(b.blobId);
    const latest = await latestReport(p.id, "SCES_509.16");
    expect(latest?.commitSha).toBe("b");
    const full = await loadReport(latest!);
    expect(full?.measures.matched_functions).toBe(4520);
    expect(full?.units).toHaveLength(6);
    expect(await defaultVersion(p)).toBe("SCES_509.16");
    expect((await findProject("openrac", "RAC1-DECOMP"))?.id).toBe(p.id);
  });

  it("keeps imported history without overwriting real reports", async () => {
    const p = await makeProject();
    await storeReport({
      project: p,
      version: "v",
      commit: { sha: "real", timestamp: new Date("2026-10-03") },
      report: report(),
      source: "upload",
    });
    const m = report().measures;
    const n = await storeMeasuresOnly(p, "v", [
      { commit: { sha: "old", timestamp: new Date("2026-09-01") }, measures: { ...m, matched_functions: 1 } },
      { commit: { sha: "real", timestamp: new Date("2026-10-03") }, measures: { ...m, matched_functions: 2 } },
    ]);
    expect(n).toBe(1);
    const h = await history(p.id, "v");
    expect(h.map((r) => [r.commitSha, r.measures.matched_functions])).toEqual([
      ["old", 1],
      ["real", 4520],
    ]);
  });

  it("lists projects with their latest measures and prunes old full reports", async () => {
    const p = await makeProject();
    await makeProject({ owner: "x", repo: "empty", name: "Empty", githubId: 2 });
    await storeReport({
      project: p,
      version: "v",
      commit: { sha: "old", timestamp: new Date("2020-01-01") },
      report: report(),
      source: "artifact",
    });
    const r = report();
    r.measures.matched_functions = 1;
    await storeReport({ project: p, version: "v", commit: { sha: "new", timestamp: new Date() }, report: r, source: "artifact" });
    const index = await projectIndex();
    expect(index.map((x) => [x.repo, x.measures?.matched_functions ?? null])).toEqual([
      ["empty", null],
      ["rac1-decomp", 1],
    ]);
    expect(await pruneReports(30)).toBe(1);
    const h = await history(p.id, "v");
    expect(h).toHaveLength(2);
    expect(await loadReport((await latestReport(p.id, "v"))!)).not.toBeNull();
  });
});
