import { and, eq } from "drizzle-orm";
import type { Octokit } from "octokit";
import { db } from "../db/client";
import { prComments, type Project } from "../db/schema";
import { latestFullReport, loadReport } from "../db/store";
import { config } from "../lib/config";
import { reportChanges, summarizeFunctions, type ChangeItem } from "../report/changes";
import { formatBytes, formatCount, formatPercent } from "../report/measures";
import { parseReport } from "../report/parse";
import type { Measures, Report } from "../report/types";
import { downloadReport, getRun, reportArtifacts, type WorkflowRun } from "./artifacts";
import { repoClient } from "./client";
import { versionsOf } from "../ingest/github";

/** Hidden marker so the comment can be found again even if the database lost track of it. */
export const MARKER = "<!-- bytematch:progress -->";
const LIST_LIMIT = 30;

export interface VersionDiff {
  version: string;
  base?: Measures;
  head: Measures;
  report?: { from: Report; to: Report };
}

function delta(now: number, before: number | undefined, fmt: (n: number) => string, unit = ""): string {
  if (before === undefined) return `${fmt(now)}${unit}`;
  const d = now - before;
  if (Math.abs(d) < 1e-9) return `${fmt(now)}${unit}`;
  return `${fmt(now)}${unit} (${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}${unit})`;
}

const pct = (n: number) => n.toFixed(2);

function measureRows(head: Measures, base?: Measures): string[] {
  const rows: [string, string][] = [
    [
      "Code matched",
      `${delta(head.matched_code_percent, base?.matched_code_percent, pct, "%")} · ${formatBytes(head.matched_code)} of ${formatBytes(head.total_code)}`,
    ],
    ["Fuzzy match", delta(head.fuzzy_match_percent, base?.fuzzy_match_percent, pct, "%")],
    ["Functions", `${delta(head.matched_functions, base?.matched_functions, formatCount)} / ${formatCount(head.total_functions)}`],
  ];
  if (head.total_data > 0) rows.push(["Data matched", delta(head.matched_data_percent, base?.matched_data_percent, pct, "%")]);
  if (head.total_units > 0)
    rows.push(["Units complete", `${delta(head.complete_units, base?.complete_units, formatCount)} / ${formatCount(head.total_units)}`]);
  return ["| | |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`)];
}

function functionList(title: string, items: ChangeItem[], show: (f: ChangeItem) => string): string[] {
  if (!items.length) return [];
  const shown = items.slice(0, LIST_LIMIT).map((f) => `- \`${(f.metadata?.demangled_name ?? f.name).replace(/`/g, "'")}\` ${show(f)}`);
  if (items.length > LIST_LIMIT) shown.push(`- …and ${items.length - LIST_LIMIT} more`);
  return [`<details${title.startsWith("⚠") ? " open" : ""}><summary>${title} (${items.length})</summary>`, "", ...shown, "", "</details>"];
}

/** The comment body for a PR whose run produced DIFFS. */
export function renderComment(
  project: Pick<Project, "owner" | "repo" | "name">,
  run: Pick<WorkflowRun, "headSha">,
  diffs: VersionDiff[],
): string {
  const url = `${config().PUBLIC_URL}/${project.owner}/${project.repo}`;
  const out = [MARKER, `### ${config().SITE_NAME} progress report`, ""];
  for (const d of diffs) {
    if (diffs.length > 1) out.push(`#### ${d.version}`, "");
    if (!d.base) out.push("_No report on the base branch yet to compare with._", "");
    out.push(...measureRows(d.head, d.base), "");
    if (d.report) {
      const s = summarizeFunctions(reportChanges(d.report.from, d.report.to));
      const size = (f: ChangeItem) => `(${formatCount(f.to?.size ?? f.from?.size ?? 0)} bytes)`;
      const fromTo = (f: ChangeItem) =>
        `${formatPercent(f.from?.fuzzy_match_percent ?? 0)} → ${formatPercent(f.to?.fuzzy_match_percent ?? 0)}`;
      out.push(
        ...functionList("✅ Newly matched", s.newlyMatched, size),
        ...functionList("⚠️ No longer matching", s.regressed, fromTo),
        ...functionList("📈 Improved", s.improved, fromTo),
        ...functionList("📉 Worse", s.worsened, fromTo),
      );
      if (!s.newlyMatched.length && !s.regressed.length && !s.improved.length && !s.worsened.length) out.push("_No function changes._");
      out.push("");
    }
  }
  out.push(`<sub>Commit ${run.headSha.slice(0, 7)} · [${project.name} on ${config().SITE_NAME}](${url})</sub>`);
  return out.join("\n");
}

/** Pull requests a run belongs to, including runs from forks (which GitHub does not link). */
async function pullRequestsOf(octokit: Octokit, project: Project, run: WorkflowRun): Promise<number[]> {
  if (run.pullRequests.length) return run.pullRequests;
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls", {
    owner: project.owner,
    repo: project.repo,
    commit_sha: run.headSha,
  });
  const found = data.filter((p) => p.state === "open").map((p) => p.number);
  if (found.length || !run.headRepo || !run.headBranch) return found;
  const { data: prs } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
    owner: project.owner,
    repo: project.repo,
    state: "open",
    head: `${run.headRepo.split("/")[0]}:${run.headBranch}`,
  });
  return prs.filter((p) => p.head.sha === run.headSha).map((p) => p.number);
}

async function upsertComment(octokit: Octokit, project: Project, pr: number, body: string, headSha: string) {
  const [known] = await db()
    .select()
    .from(prComments)
    .where(and(eq(prComments.projectId, project.id), eq(prComments.prNumber, pr)));
  let commentId: number | undefined = known?.commentId;
  if (!commentId) {
    // Look for one we wrote before (e.g. a restored database) before adding a new one.
    for await (const { data } of octokit.paginate.iterator("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: project.owner,
      repo: project.repo,
      issue_number: pr,
      per_page: 100,
    })) {
      const mine = data.find((c) => c.body?.startsWith(MARKER));
      if (mine) {
        commentId = Number(mine.id);
        break;
      }
    }
  }
  if (commentId) {
    try {
      await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner: project.owner,
        repo: project.repo,
        comment_id: commentId,
        body,
      });
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
      commentId = undefined;
    }
  }
  if (!commentId) {
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: project.owner,
      repo: project.repo,
      issue_number: pr,
      body,
    });
    commentId = Number(data.id);
  }
  await db()
    .insert(prComments)
    .values({ projectId: project.id, prNumber: pr, commentId, headSha })
    .onConflictDoUpdate({ target: [prComments.projectId, prComments.prNumber], set: { commentId, headSha, updatedAt: new Date() } });
}

/**
 * Compares a pull request run's reports with the base branch's latest and comments on the PR.
 * Needs the GitHub App (a personal token would comment as that person), so it does nothing without it.
 */
export async function commentOnRun(project: Project, runId: number): Promise<{ prs: number[]; versions: string[] }> {
  if (!project.prComments) return { prs: [], versions: [] };
  const { octokit, installationId } = await repoClient(project);
  if (!installationId) return { prs: [], versions: [] };
  const run = await getRun(octokit, project.owner, project.repo, runId);
  if (run.conclusion !== "success") return { prs: [], versions: [] };
  const prs = await pullRequestsOf(octokit, project, run);
  if (!prs.length) return { prs: [], versions: [] };

  const diffs: VersionDiff[] = [];
  for (const artifact of await reportArtifacts(octokit, project.owner, project.repo, run.id, project.artifactPattern)) {
    if (artifact.expired) continue;
    const report = parseReport((await downloadReport(octokit, project.owner, project.repo, artifact.id)).report);
    for (const [version, head] of versionsOf(project, artifact.version, report)) {
      const baseRow = await latestFullReport(project.id, version);
      const base = baseRow ? await loadReport(baseRow) : null;
      diffs.push({ version, head: head.measures, base: base?.measures, report: base ? { from: base, to: head } : undefined });
    }
  }
  if (!diffs.length) return { prs, versions: [] };
  const body = renderComment(project, run, diffs);
  for (const pr of prs) await upsertComment(octokit, project, pr, body, run.headSha);
  return { prs, versions: diffs.map((d) => d.version) };
}
