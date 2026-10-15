import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tokenClient } from "../github/client";
import { config, githubAppConfigured, signInConfigured } from "./config";
import { getSettings } from "./settings";

export interface Health {
  worker: { lastBeat: string | null; alive: boolean };
  jobs: { name: string; state: string; count: number }[];
  failedRecent: { id: string; name: string; data: unknown; output: unknown; createdOn: string; completedOn: string | null }[];
  githubToken: { configured: boolean; remaining?: number; limit?: number; resetsAt?: string; error?: string };
  app: { configured: boolean; webhooks: boolean; signIn: boolean };
  syncPaused: boolean;
}

/** Everything the admin overview shows, gathered in parallel. Nothing here reveals the token itself. */
export async function health(): Promise<Health> {
  const c = config();
  const [settings, jobs, failed, rate] = await Promise.all([
    getSettings(),
    db()
      .execute<{ name: string; state: string; count: number }>(
        sql`select name, state::text as state, count(*)::int as count from pgboss.job group by 1, 2 order by 1, 2`,
      )
      .then((r) => [...r])
      .catch(() => []),
    db()
      .execute<{ id: string; name: string; data: unknown; output: unknown; created_on: string; completed_on: string | null }>(
        sql`select id::text, name, data, output, created_on, completed_on from pgboss.job where state = 'failed' order by created_on desc limit 50`,
      )
      .then((r) => [...r])
      .catch(() => []),
    c.GITHUB_TOKEN
      ? tokenClient()
          .request("GET /rate_limit")
          .then(({ data }) => ({
            remaining: data.resources.core.remaining,
            limit: data.resources.core.limit,
            resetsAt: new Date(data.resources.core.reset * 1000).toISOString(),
          }))
          .catch((e: { status?: number }) => ({ error: e.status === 401 ? "The token is invalid or expired." : "GitHub didn't answer." }))
      : Promise.resolve(undefined),
  ]);
  const beat = settings.workerHeartbeat;
  return {
    worker: { lastBeat: beat, alive: !!beat && Date.now() - new Date(beat).getTime() < 3 * 60_000 },
    jobs,
    failedRecent: failed.map((f) => ({
      id: f.id,
      name: f.name,
      data: f.data,
      output: f.output,
      createdOn: new Date(f.created_on).toISOString(),
      completedOn: f.completed_on ? new Date(f.completed_on).toISOString() : null,
    })),
    githubToken: { configured: !!c.GITHUB_TOKEN, ...(rate ?? {}) },
    app: { configured: githubAppConfigured(), webhooks: !!c.GITHUB_WEBHOOK_SECRET, signIn: signInConfigured() },
    syncPaused: settings.syncPaused,
  };
}
