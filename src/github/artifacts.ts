import { unzipSync } from "fflate";
import { ReportProblem } from "../lib/problems";
import type { Octokit } from "octokit";
import { config } from "../lib/config";

export interface WorkflowRun {
  id: number;
  headSha: string;
  headBranch: string | null;
  event: string;
  path: string;
  conclusion: string | null;
  commitMessage: string | null;
  commitTimestamp: Date;
  /** Pull request numbers GitHub links to the run (same-repository PRs only). */
  pullRequests: number[];
  headRepo: string | null;
}

export interface ReportArtifact {
  id: number;
  name: string;
  /** The game version the artifact name gives (the pattern's "version" group). */
  version: string;
  expired: boolean;
  sizeInBytes: number;
}

type RawRun = {
  id: number;
  head_sha: string;
  head_branch: string | null;
  event: string;
  path: string;
  conclusion: string | null;
  run_started_at?: string | null;
  created_at: string;
  head_commit?: { message?: string; timestamp?: string } | null;
  pull_requests?: { number: number }[] | null;
  head_repository?: { full_name?: string } | null;
};

export function toRun(r: RawRun): WorkflowRun {
  return {
    id: r.id,
    headSha: r.head_sha,
    headBranch: r.head_branch,
    event: r.event,
    path: r.path,
    conclusion: r.conclusion,
    commitMessage: r.head_commit?.message ?? null,
    commitTimestamp: new Date(r.head_commit?.timestamp ?? r.run_started_at ?? r.created_at),
    pullRequests: (r.pull_requests ?? []).map((p) => p.number),
    headRepo: r.head_repository?.full_name ?? null,
  };
}

/** Does RUN come from the workflow the project restricts itself to (a file name like "build.yml")? */
export function fromWorkflow(run: Pick<WorkflowRun, "path">, workflow: string | null): boolean {
  if (!workflow) return true;
  const file = run.path.split("@")[0].split("/").pop();
  return file === workflow || run.path === workflow;
}

/** Successful runs on BRANCH, newest first, one page at a time. */
export async function listRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  page = 1,
  perPage = 30,
): Promise<WorkflowRun[]> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
    owner,
    repo,
    branch,
    status: "success",
    per_page: perPage,
    page,
    exclude_pull_requests: true,
  });
  return (data.workflow_runs as RawRun[]).filter((r) => r.event !== "pull_request" && r.event !== "pull_request_target").map(toRun);
}

export async function getRun(octokit: Octokit, owner: string, repo: string, runId: number): Promise<WorkflowRun> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}", { owner, repo, run_id: runId });
  return toRun(data as RawRun);
}

export function versionFromName(name: string, pattern: string): string | undefined {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    return undefined;
  }
  const m = re.exec(name);
  if (!m) return undefined;
  return m.groups?.version ?? m[1] ?? name;
}

/** The run's artifacts whose names match the project's report pattern. */
export async function reportArtifacts(
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number,
  pattern: string,
): Promise<ReportArtifact[]> {
  const out: ReportArtifact[] = [];
  for (let page = 1; ; page++) {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", {
      owner,
      repo,
      run_id: runId,
      per_page: 100,
      page,
    });
    for (const a of data.artifacts) {
      const version = versionFromName(a.name, pattern);
      if (version) out.push({ id: a.id, name: a.name, version, expired: a.expired, sizeInBytes: a.size_in_bytes });
    }
    if (data.artifacts.length < 100) break;
  }
  return out;
}

/** Downloads an artifact and returns the report file inside it. */
export async function downloadReport(octokit: Octokit, owner: string, repo: string, artifactId: number): Promise<Uint8Array> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}", {
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: "zip",
  });
  return reportFromZip(new Uint8Array(data as ArrayBuffer));
}

/**
 * The report in an artifact zip: the only file, else report.json / report.binpb, else the one
 * file whose name contains "report". Refuses archives that unpack past MAX_REPORT_BYTES.
 */
export function reportFromZip(zip: Uint8Array): Uint8Array {
  const limit = config().MAX_REPORT_BYTES;
  let total = 0;
  const files = unzipSync(zip, {
    filter: (f) => {
      if (f.name.endsWith("/")) return false;
      total += f.originalSize;
      if (total > limit) throw new ReportProblem("artifact-too-big", `artifact unpacks to more than ${limit} bytes`, { limit });
      return true;
    },
  });
  const names = Object.keys(files);
  if (names.length === 0) throw new ReportProblem("artifact-empty", "artifact is empty");
  const base = (n: string) => n.split("/").pop()!.toLowerCase();
  const pick =
    (names.length === 1 && names[0]) ||
    names.find((n) => ["report.json", "report.binpb", "report.pb"].includes(base(n))) ||
    (names.filter((n) => base(n).includes("report")).length === 1 ? names.find((n) => base(n).includes("report")) : undefined);
  if (!pick) {
    throw new ReportProblem("no-report-file", `artifact has several files and none is report.json: ${names.slice(0, 5).join(", ")}`, {
      files: names.slice(0, 20),
    });
  }
  return files[pick];
}
