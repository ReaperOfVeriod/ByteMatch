import { count, eq } from "drizzle-orm";
import { db } from "../db/client";
import { ingestProblems, type Project } from "../db/schema";
import { latestProblem } from "../ingest/github";
import { redact } from "./errors";
import { explain, problemCode, type Explanation, type ProblemCode, type ProblemDetail } from "./problems";

export interface ProjectProblem {
  code: ProblemCode;
  explanation: Explanation;
  /** The error as recorded, scrubbed of tokens and IDs: for the "technical details" disclosure. */
  technical: string;
  at: Date | null;
  runUrl: string | null;
  artifact: string | null;
}

/** What's wrong with a project's syncing, for its maintainers; null when nothing is. */
export async function projectProblem(project: Project): Promise<ProjectProblem | null> {
  if (!project.lastError) return null;
  const code = problemCode(project.lastError);
  // Artifact problems are recorded per run, with the files and the artifact's name.
  const row = ["no-report-file", "artifact-empty", "artifact-too-big", "report-unreadable"].includes(code)
    ? await latestProblem(project.id)
    : undefined;
  const runUrl = row ? `https://github.com/${project.owner}/${project.repo}/actions/runs/${row.runId}` : null;
  return {
    code,
    explanation: explain(code, (row?.detail ?? {}) as ProblemDetail, { artifact: row?.artifact, runUrl }),
    technical: redact(project.lastError),
    at: project.lastErrorAt,
    runUrl,
    artifact: row?.artifact ?? null,
  };
}

/** How many CI runs are being skipped because their artifacts couldn't be used. */
export async function skippedRuns(projectId: number): Promise<number> {
  const [row] = await db().select({ n: count() }).from(ingestProblems).where(eq(ingestProblems.projectId, projectId));
  return row?.n ?? 0;
}
