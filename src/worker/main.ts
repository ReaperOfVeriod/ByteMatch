import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { closeDb, db } from "../db/client";
import { projects, type Project } from "../db/schema";
import { pruneReports } from "../db/store";
import { commentOnRun } from "../github/comments";
import { importFromDecompDev } from "../ingest/decompdev";
import { ingestRunById, pollProject, recordError } from "../ingest/github";
import { config } from "../lib/config";
import { boss, enqueue, JOBS, stopQueue, type JobData, type JobName } from "../lib/queue";

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

async function project(id: number): Promise<Project | undefined> {
  const [p] = await db().select().from(projects).where(eq(projects.id, id));
  return p?.enabled ? p : undefined;
}

/** Runs HANDLER for each job; a failure is recorded on the project and the job retried by pg-boss. */
function handle<N extends JobName>(name: N, handler: (data: JobData[N]) => Promise<unknown>) {
  return async (jobs: Job<JobData[N]>[]) => {
    for (const job of jobs) {
      const started = Date.now();
      try {
        const result = await handler(job.data);
        log(`[${name}]`, JSON.stringify(job.data), "→", JSON.stringify(result ?? null), `${Date.now() - started}ms`);
      } catch (e) {
        log(`[${name}] failed`, JSON.stringify(job.data), e instanceof Error ? e.stack : e);
        const projectId = (job.data as { projectId?: number }).projectId;
        if (projectId) await recordError(projectId, e).catch(() => {});
        throw e;
      }
    }
  };
}

export async function startWorker() {
  const b = await boss();
  const c = config();
  const opts = { localConcurrency: c.WORKER_CONCURRENCY, batchSize: 1 };

  await b.work(
    JOBS.ingestRun,
    opts,
    handle(JOBS.ingestRun, async ({ projectId, runId, force }) => {
      const p = await project(projectId);
      return p ? ingestRunById(p, runId, force) : "project disabled or gone";
    }),
  );
  await b.work(
    JOBS.pollProject,
    opts,
    handle(JOBS.pollProject, async ({ projectId }) => {
      const p = await project(projectId);
      if (!p) return "project disabled or gone";
      const results = await pollProject(p);
      return results.filter((r) => r.stored.length).map((r) => ({ run: r.runId, stored: r.stored }));
    }),
  );
  await b.work(
    JOBS.backfill,
    { ...opts, localConcurrency: 1 },
    handle(JOBS.backfill, async ({ projectId, maxRuns }) => {
      const p = await project(projectId);
      if (!p) return "project disabled or gone";
      const results = await pollProject(p, Math.min(maxRuns ?? 500, 2000));
      return { runs: results.length, stored: results.reduce((n, r) => n + r.stored.length, 0) };
    }),
  );
  await b.work(
    JOBS.importDecompDev,
    { ...opts, localConcurrency: 1 },
    handle(JOBS.importDecompDev, async ({ projectId }) => {
      const p = await project(projectId);
      return p ? importFromDecompDev(p) : "project disabled or gone";
    }),
  );
  await b.work(
    JOBS.prComment,
    opts,
    handle(JOBS.prComment, async ({ projectId, runId }) => {
      const p = await project(projectId);
      return p ? commentOnRun(p, runId) : "project disabled or gone";
    }),
  );
  await b.work(
    JOBS.pollAll,
    handle(JOBS.pollAll, async () => {
      const all = await db().select({ id: projects.id }).from(projects).where(eq(projects.enabled, true));
      for (const p of all) await enqueue(JOBS.pollProject, { projectId: p.id }, `poll:${p.id}`);
      return { queued: all.length };
    }),
  );
  await b.work(
    JOBS.prune,
    handle(JOBS.prune, async () => ({ pruned: await pruneReports(config().REPORT_RETENTION_DAYS) })),
  );

  const every = c.POLL_INTERVAL_MINUTES;
  await b.schedule(JOBS.pollAll, every >= 60 ? `0 */${Math.floor(every / 60)} * * *` : `*/${every} * * * *`);
  await b.schedule(JOBS.prune, "17 3 * * *");
  log(`worker started: polling every ${every} min, concurrency ${c.WORKER_CONCURRENCY}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("src/worker/main.ts")) {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    log("stopping");
    await stopQueue();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  startWorker().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
