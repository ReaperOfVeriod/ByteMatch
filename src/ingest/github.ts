import { and, eq, inArray } from "drizzle-orm";
import type { Octokit } from "octokit";
import { db } from "../db/client";
import { projects, reports, type Project } from "../db/schema";
import { storeReport } from "../db/store";
import { downloadReport, fromWorkflow, getRun, listRuns, reportArtifacts, type WorkflowRun } from "../github/artifacts";
import { repoClient } from "../github/client";
import { redact } from "../lib/errors";
import { parseReport, splitReport } from "../report/parse";
import type { Report } from "../report/types";

export interface RunResult {
  runId: number;
  stored: string[];
  skipped: string[];
}

/** The reports in an artifact: one, or one per version for projects that report all versions together. */
export function versionsOf(project: Pick<Project, "splitVersions">, artifactVersion: string, report: Report): [string, Report][] {
  if (!project.splitVersions) return [[artifactVersion, report]];
  const parts = splitReport(report);
  return parts.size ? [...parts] : [[artifactVersion, report]];
}

async function storedVersions(projectId: number, sha: string): Promise<Set<string>> {
  const rows = await db()
    .select({ version: reports.version, source: reports.source })
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.commitSha, sha)));
  return new Set(rows.filter((r) => r.source !== "import").map((r) => r.version));
}

/** Reads one run's report artifacts into the database. */
export async function ingestRun(project: Project, run: WorkflowRun, octokit: Octokit, force = false): Promise<RunResult> {
  const result: RunResult = { runId: run.id, stored: [], skipped: [] };
  const have = force ? new Set<string>() : await storedVersions(project.id, run.headSha);
  const artifacts = await reportArtifacts(octokit, project.owner, project.repo, run.id, project.artifactPattern);
  for (const artifact of artifacts) {
    if (artifact.expired || (!project.splitVersions && have.has(artifact.version))) {
      result.skipped.push(artifact.version);
      continue;
    }
    const report = parseReport(await downloadReport(octokit, project.owner, project.repo, artifact.id));
    for (const [version, part] of versionsOf(project, artifact.version, report)) {
      if (have.has(version)) {
        result.skipped.push(version);
        continue;
      }
      await storeReport({
        project,
        version,
        commit: { sha: run.headSha, message: run.commitMessage, timestamp: run.commitTimestamp },
        report: part,
        source: "artifact",
        runId: run.id,
      });
      result.stored.push(version);
    }
  }
  return result;
}

async function remember(project: Project, patch: Partial<Project>) {
  await db().update(projects).set(patch).where(eq(projects.id, project.id));
}

export async function recordError(projectId: number, error: unknown) {
  await db()
    .update(projects)
    .set({ lastError: redact(error instanceof Error ? error.message : String(error)), lastErrorAt: new Date() })
    .where(eq(projects.id, projectId));
}

/** Ingests one run by id (webhook path). */
export async function ingestRunById(project: Project, runId: number, force = false): Promise<RunResult | undefined> {
  const { octokit, installationId } = await repoClient(project);
  if (installationId && installationId !== project.installationId) await remember(project, { installationId });
  const run = await getRun(octokit, project.owner, project.repo, runId);
  if (run.conclusion !== "success" || run.headBranch !== project.defaultBranch || run.event.startsWith("pull_request")) return undefined;
  if (!fromWorkflow(run, project.workflow)) return undefined;
  return ingestRun(project, run, octokit, force);
}

/**
 * Looks through the newest successful default-branch runs (MAX_RUNS at most) and ingests the
 * ones whose commits are not stored yet, oldest first so history grows in order.
 */
export async function pollProject(project: Project, maxRuns = 20): Promise<RunResult[]> {
  const { octokit, installationId } = await repoClient(project);
  const runs: WorkflowRun[] = [];
  for (let page = 1; runs.length < maxRuns; page++) {
    const batch = await listRuns(octokit, project.owner, project.repo, project.defaultBranch, page, Math.min(100, maxRuns));
    runs.push(...batch.filter((r) => fromWorkflow(r, project.workflow)));
    if (batch.length < Math.min(100, maxRuns)) break;
  }
  const shas = [...new Set(runs.map((r) => r.headSha))];
  const known = shas.length
    ? new Set(
        (
          await db()
            .selectDistinct({ sha: reports.commitSha })
            .from(reports)
            .where(and(eq(reports.projectId, project.id), inArray(reports.commitSha, shas), eq(reports.source, "artifact")))
        ).map((r) => r.sha),
      )
    : new Set<string>();
  const results: RunResult[] = [];
  const seen = new Set<string>();
  for (const run of runs.slice(0, maxRuns).reverse()) {
    if (known.has(run.headSha) || seen.has(run.headSha)) continue;
    const r = await ingestRun(project, run, octokit);
    // A commit can have several successful runs; only the one that carries reports counts.
    if (r.stored.length) seen.add(run.headSha);
    results.push(r);
  }
  // Reaching the repository at all means the last error no longer applies (and a hidden project shows again).
  await remember(project, {
    lastPolledAt: new Date(),
    lastError: null,
    lastErrorAt: null,
    ...(installationId && installationId !== project.installationId ? { installationId } : {}),
  });
  return results;
}
