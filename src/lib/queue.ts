import { PgBoss } from "pg-boss";
import { config } from "./config";

/** Background jobs, kept in Postgres (schema "pgboss"): any number of web and worker processes share them. */
export const JOBS = {
  /** Read one workflow run's report artifacts: { projectId, runId }. */
  ingestRun: "ingest-run",
  /** Look for new successful runs on a project's default branch: { projectId }. */
  pollProject: "poll-project",
  /** Schedule: queue pollProject for every enabled project. */
  pollAll: "poll-all",
  /** Walk older runs whose artifacts have not expired: { projectId, maxRuns }. */
  backfill: "backfill",
  /** Copy a project's history from decomp.dev: { projectId }. */
  importDecompDev: "import-decompdev",
  /** Comment on a pull request with the progress its run makes: { projectId, runId }. */
  prComment: "pr-comment",
  /** Schedule: drop full reports past REPORT_RETENTION_DAYS. */
  prune: "prune",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

export interface JobData {
  "ingest-run": { projectId: number; runId: number; force?: boolean };
  "poll-project": { projectId: number };
  "poll-all": Record<string, never>;
  backfill: { projectId: number; maxRuns?: number };
  "import-decompdev": { projectId: number };
  "pr-comment": { projectId: number; runId: number };
  prune: Record<string, never>;
}

const g = globalThis as unknown as { __bytematchBoss?: Promise<PgBoss> };

export function boss(): Promise<PgBoss> {
  return (g.__bytematchBoss ??= (async () => {
    const b = new PgBoss({ connectionString: config().DATABASE_URL, schema: "pgboss", max: 4 });
    b.on("error", (e) => console.error("[queue]", e));
    await b.start();
    for (const name of Object.values(JOBS)) {
      // One queued job per key: a burst of webhooks for the same run or project collapses into one.
      await b
        .createQueue(name, { policy: "stately", retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 900 })
        .catch(() => {});
    }
    return b;
  })());
}

/** Queues a job; KEY collapses duplicates that are still waiting. */
export async function enqueue<N extends JobName>(name: N, data: JobData[N], key?: string): Promise<string | null> {
  return (await boss()).send(name, data, key ? { singletonKey: key } : {});
}

export async function stopQueue() {
  const b = await g.__bytematchBoss;
  g.__bytematchBoss = undefined;
  await b?.stop({ graceful: true, timeout: 30_000 });
}
