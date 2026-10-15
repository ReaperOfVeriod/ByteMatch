import { readFileSync } from "node:fs";
import { zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";
import { history, latestReport, loadFunctionalList, loadReport } from "../db/store";
import { readArtifact, reportFromZip, versionFromName } from "../github/artifacts";
import { renderComment } from "../github/comments";
import { parseReport } from "../report/parse";
import { importFromDecompDev, versionNames } from "./decompdev";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { projects } from "../db/schema";
import { ReportProblem } from "../lib/problems";
import { latestProblem, pollProject } from "./github";

const fixture = readFileSync(new URL("../../test/fixtures/report-v2.json", import.meta.url));

/** Just enough of Octokit for the ingest paths: runs, artifacts and artifact downloads. */
type FakeArtifact = { id: number; name: string; data?: Uint8Array; files?: Record<string, Uint8Array> };
function fakeGitHub(runs: { id: number; sha: string; time: string; artifacts: FakeArtifact[] }[]) {
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
      return {
        data: { artifacts: run.artifacts.map((a) => ({ id: a.id, name: a.name, expired: false, size_in_bytes: a.data?.length ?? 1 })) },
      };
    }
    if (route === "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}") {
      const a = runs.flatMap((r) => r.artifacts).find((x) => x.id === params.artifact_id)!;
      return { data: zipSync(a.files ?? { "report.json": a.data! }).buffer };
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

  it("reads a functional list beside the report, and never as the report", () => {
    const files = readArtifact(zipSync({ "report.json": new Uint8Array([1]), "functional.json": new Uint8Array([2]) }));
    expect(files.report).toEqual(new Uint8Array([1]));
    expect(files.functional).toEqual({ name: "functional.json", data: new Uint8Array([2]) });
    // A report that is the artifact's only other file is still found.
    expect(readArtifact(zipSync({ "progress/x.json": new Uint8Array([3]), "functional.tsv": new Uint8Array([4]) })).report).toEqual(
      new Uint8Array([3]),
    );
    expect(readArtifact(zipSync({ "report.json": new Uint8Array([1]) })).functional).toBeNull();
  });

  it("says which files an artifact without a report holds", () => {
    const zip = zipSync({ "build/GUNE5D/config.json": new Uint8Array([1]), "objdiff.json": new Uint8Array([2]) });
    try {
      reportFromZip(zip);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ReportProblem);
      expect((e as ReportProblem).code).toBe("no-report-file");
      expect((e as ReportProblem).detail.files).toEqual(["build/GUNE5D/config.json", "objdiff.json"]);
    }
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

  it("records a run without a report, reads the others, and skips it afterwards", async () => {
    const p = await makeProject();
    const broken = { "build/GUNE5D/config.json": new Uint8Array([1]), "objdiff.json": new Uint8Array([2]) };
    const runs = [
      { id: 3, sha: "ccc", time: "2026-10-03T00:00:00Z", artifacts: [{ id: 30, name: "GUNE5D_report", data: new Uint8Array(fixture) }] },
      { id: 2, sha: "bbb", time: "2026-10-02T00:00:00Z", artifacts: [{ id: 20, name: "GUNE5D_report", files: broken }] },
      { id: 1, sha: "aaa", time: "2026-10-01T00:00:00Z", artifacts: [{ id: 10, name: "GUNE5D_report", data: new Uint8Array(fixture) }] },
    ];
    github.client = fakeGitHub(runs);
    const results = await pollProject(p);
    expect(results.map((r) => [r.runId, r.stored, r.problems.length])).toEqual([
      [1, ["GUNE5D"], 0],
      [2, [], 1],
      [3, ["GUNE5D"], 0],
    ]);
    // The newest run is fine, so there's nothing to tell the maintainers.
    const [after] = await db().select().from(projects).where(eq(projects.id, p.id));
    expect(after.lastError).toBeNull();
    expect(await latestProblem(p.id)).toMatchObject({ runId: 2, artifact: "GUNE5D_report", code: "no-report-file" });

    // The broken run is not downloaded again.
    const again = fakeGitHub(runs);
    github.client = again;
    expect(await pollProject(p)).toEqual([]);
    expect(again.request.mock.calls.filter(([route]) => String(route).includes("artifacts"))).toHaveLength(0);
  });

  it("stores what an artifact's functional list adds up to", async () => {
    const p = await makeProject();
    // The fixture is fully matched: mark three functions unmatched for this test.
    const raw = JSON.parse(fixture.toString());
    const all: { name: string; size: string; fuzzy_match_percent: number }[] = raw.units.flatMap(
      (u: { functions: unknown[] }) => u.functions,
    );
    for (const f of all.slice(0, 3)) f.fuzzy_match_percent = 50;
    const reportBytes = new TextEncoder().encode(JSON.stringify(raw));
    const parsed = parseReport(reportBytes);
    const unmatched = all.slice(0, 3).map((f) => ({ name: f.name, size: Number(f.size) }));
    const matched = all[3];
    const list = { functions: [...unmatched.map((f) => ({ name: f.name, confidence: "high" })), { name: matched.name }] };
    const runs = [
      {
        id: 1,
        sha: "aaa",
        time: "2026-10-01T00:00:00Z",
        artifacts: [
          {
            id: 10,
            name: "SCES_509.16_report",
            files: { "report.json": reportBytes, "functional.json": new TextEncoder().encode(JSON.stringify(list)) },
          },
        ],
      },
    ];
    github.client = fakeGitHub(runs);
    await pollProject(p);
    const row = (await latestReport(p.id, "SCES_509.16"))!;
    expect(row.functional).toMatchObject({ functions: 3, already_matched: 1, listed: 4 });
    expect(row.functional && "code" in row.functional ? row.functional.code : 0).toBe(
      unmatched.slice(0, 3).reduce((n, f) => n + f.size, 0),
    );
    // The measures are the report's own: functional C is never progress.
    expect(row.measures).toEqual(parsed.measures);
    expect((await loadFunctionalList(row))?.get(unmatched[0].name)).toBe("high");
  });

  it("tells the maintainers when the newest run has no report, without failing", async () => {
    const p = await makeProject();
    const runs = [
      {
        id: 2,
        sha: "bbb",
        time: "2026-10-02T00:00:00Z",
        artifacts: [{ id: 20, name: "GUNE5D_report", files: { "a.txt": new Uint8Array([1]), "b.txt": new Uint8Array([2]) } }],
      },
      { id: 1, sha: "aaa", time: "2026-10-01T00:00:00Z", artifacts: [{ id: 10, name: "GUNE5D_report", data: new Uint8Array(fixture) }] },
    ];
    github.client = fakeGitHub(runs);
    await pollProject(p);
    const [after] = await db().select().from(projects).where(eq(projects.id, p.id));
    expect(after.lastError).toMatch(/none is report.json/);
    // Still true on the next poll, which downloads nothing.
    github.client = fakeGitHub(runs);
    await pollProject(p);
    const [still] = await db().select().from(projects).where(eq(projects.id, p.id));
    expect(still.lastError).toMatch(/none is report.json/);
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
      expect(result).toEqual({ found: true, versions: [{ version: "SCES_509.16", history: hist.length, report: true }] });
      const latest = await latestReport(p.id, "SCES_509.16");
      expect(latest?.commitSha).toBe(hist[0].commit_sha);
      expect(latest?.blobId).not.toBeNull();
      expect(await history(p.id, "SCES_509.16")).toHaveLength(hist.length);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("treats a project decomp.dev never tracked as nothing to import", async () => {
    const p = await makeProject();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("Not found", { status: 404 }));
    try {
      expect(await importFromDecompDev(p)).toEqual({ found: false, versions: [] });
      expect(await history(p.id, "SCES_509.16")).toHaveLength(0);
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
