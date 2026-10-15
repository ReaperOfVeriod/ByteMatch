import { readFileSync } from "node:fs";
import { zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";
import { history, latestReport, loadReport } from "../db/store";
import { reportFromZip, versionFromName } from "../github/artifacts";
import { renderComment } from "../github/comments";
import { parseReport } from "../report/parse";
import { importFromDecompDev, versionNames } from "./decompdev";
import { pollProject } from "./github";

const fixture = readFileSync(new URL("../../test/fixtures/report-v2.json", import.meta.url));

/** Just enough of Octokit for the ingest paths: runs, artifacts and artifact downloads. */
function fakeGitHub(runs: { id: number; sha: string; time: string; artifacts: { id: number; name: string; data: Uint8Array }[] }[]) {
  const request = vi.fn(async (route: string, params: Record<string, unknown>) => {
    if (route === "GET /repos/{owner}/{repo}/actions/runs") {
      return {
        data: {
          workflow_runs: runs.map((r) => ({
            id: r.id,
            head_sha: r.sha,
            head_branch: "main",
            event: "push",
            path: ".github/workflows/build.yml",
            conclusion: "success",
            created_at: r.time,
            head_commit: { message: `commit ${r.sha}`, timestamp: r.time },
          })),
        },
      };
    }
    if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts") {
      const run = runs.find((r) => r.id === params.run_id)!;
      return { data: { artifacts: run.artifacts.map((a) => ({ id: a.id, name: a.name, expired: false, size_in_bytes: a.data.length })) } };
    }
    if (route === "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}") {
      const a = runs.flatMap((r) => r.artifacts).find((x) => x.id === params.artifact_id)!;
      return { data: zipSync({ "report.json": a.data }).buffer };
    }
    throw new Error(`unexpected ${route}`);
  });
  return { request };
}

const github = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("../github/client", () => ({
  repoClient: async () => ({ octokit: github.client }),
}));

describe("artifacts", () => {
  it("reads the version from the artifact name", () => {
    expect(versionFromName("SCES_509.16_report", "^(?<version>.+)_report$")).toBe("SCES_509.16");
    expect(versionFromName("build-logs", "^(?<version>.+)_report$")).toBeUndefined();
    expect(versionFromName("report", "^report$")).toBe("report");
  });

  it("finds the report in an artifact zip", () => {
    expect(reportFromZip(zipSync({ "report.json": new Uint8Array([123]) }))).toEqual(new Uint8Array([123]));
    expect(reportFromZip(zipSync({ "a/report.binpb": new Uint8Array([1]), "a/log.txt": new Uint8Array([2]) }))).toEqual(
      new Uint8Array([1]),
    );
    expect(() => reportFromZip(zipSync({ "a.txt": new Uint8Array([1]), "b.txt": new Uint8Array([2]) }))).toThrow(/none is report.json/);
  });
});

describe.skipIf(!TEST_DB)("ingest", () => {
  useTestDb();

  it("polls new default-branch runs into history, oldest first, once", async () => {
    const p = await makeProject();
    const second = parseReport(fixture);
    second.measures.matched_functions += 7;
    const runs = [
      {
        id: 2,
        sha: "bbb",
        time: "2026-10-02T00:00:00Z",
        artifacts: [
          {
            id: 20,
            name: "SCES_509.16_report",
            data: new TextEncoder().encode(JSON.stringify({ ...JSON.parse(fixture.toString()), measures: { ...second.measures } })),
          },
          { id: 21, name: "build-logs", data: new Uint8Array([1]) },
        ],
      },
      {
        id: 1,
        sha: "aaa",
        time: "2026-10-01T00:00:00Z",
        artifacts: [{ id: 10, name: "SCES_509.16_report", data: new Uint8Array(fixture) }],
      },
    ];
    github.client = fakeGitHub(runs);
    const results = await pollProject(p);
    expect(results.map((r) => [r.runId, r.stored])).toEqual([
      [1, ["SCES_509.16"]],
      [2, ["SCES_509.16"]],
    ]);
    const h = await history(p.id, "SCES_509.16");
    expect(h.map((r) => [r.commitSha, r.measures.matched_functions])).toEqual([
      ["aaa", 4520],
      ["bbb", 4527],
    ]);
    const full = await loadReport((await latestReport(p.id, "SCES_509.16"))!);
    expect(full?.units).toHaveLength(6);

    // Second poll: nothing new to download.
    const again = fakeGitHub(runs);
    github.client = again;
    expect(await pollProject(p)).toEqual([]);
    expect(again.request.mock.calls.filter(([route]) => String(route).includes("artifacts"))).toHaveLength(0);
  });

  it("imports decomp.dev history and its latest report", async () => {
    const p = await makeProject();
    const project = JSON.parse(readFileSync(new URL("../../test/fixtures/decompdev-project.json", import.meta.url), "utf8"));
    const hist = JSON.parse(readFileSync(new URL("../../test/fixtures/decompdev-history.json", import.meta.url), "utf8"));
    expect(versionNames(project)).toEqual(["SCES_509.16"]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("rac1-decomp.json")) return new Response(JSON.stringify(project));
      if (url.includes("mode=history")) return new Response(JSON.stringify(hist));
      if (url.includes("mode=report")) return new Response(fixture);
      return new Response("not found", { status: 404 });
    });
    try {
      const result = await importFromDecompDev(p);
      expect(result.versions).toEqual([{ version: "SCES_509.16", history: hist.length, report: true }]);
      const latest = await latestReport(p.id, "SCES_509.16");
      expect(latest?.commitSha).toBe(hist[0].commit_sha);
      expect(latest?.blobId).not.toBeNull();
      expect(await history(p.id, "SCES_509.16")).toHaveLength(hist.length);
    } finally {
      fetchMock.mockRestore();
    }
  });
});

describe("PR comment", () => {
  it("lists newly matched functions and measure deltas", () => {
    const base = parseReport(fixture);
    const head = parseReport(fixture);
    base.units[0].functions[0].fuzzy_match_percent = 80;
    base.units[0].measures.matched_functions -= 1;
    base.measures.matched_functions -= 1;
    const body = renderComment({ owner: "OpenRAC", repo: "rac1-decomp", name: "Ratchet & Clank (PAL)" }, { headSha: "abcdef123" }, [
      { version: "SCES_509.16", base: base.measures, head: head.measures, report: { from: base, to: head } },
    ]);
    expect(body).toContain("<!-- bytematch:progress -->");
    expect(body).toContain("| Functions | 4,520 (+1) / 5,109 |");
    expect(body).toContain("Newly matched (1)</summary>");
    expect(body).toContain("`func_00112380` (40 bytes)");
    expect(body).toContain("Commit abcdef1");
  });
});
