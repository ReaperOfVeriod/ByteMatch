import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tokenClient } from "../github/client";
import { config, githubAppConfigured, signInConfigured } from "./config";
import { getSettings } from "./settings";

export interface Health {
  worker: { lastBeat: string | null; alive: boolean };
  jobs: { name: string; state: string; count: number }[];
  /** Failed jobs, identical ones (same job, project and error) grouped together, newest first. */
  failedGroups: FailedGroup[];
  githubToken: { configured: boolean; remaining?: number; limit?: number; resetsAt?: string; error?: string };
  app: { configured: boolean; webhooks: boolean; signIn: boolean };
  syncPaused: boolean;
}

export interface FailedGroup {
  name: string;
  /** The job's data, from its newest failure. */
  data: unknown;
  message: string;
  count: number;
  firstAt: string;
  lastAt: string;
  /** Job ids, newest first (at most 500). */
  ids: string[];
  project: { owner: string; repo: string; name: string } | null;
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
      .execute<{
        name: string;
        data: unknown;
        message: string;
        count: number;
        first_at: string;
        last_at: string;
        ids: string[];
        owner: string | null;
        repo: string | null;
        project_name: string | null;
      }>(
        sql`select j.name, (array_agg(j.data order by j.created_on desc))[1] as data,
              coalesce(j.output->>'message', j.output::text, '') as message, count(*)::int as count,
              min(j.created_on) as first_at, max(coalesce(j.completed_on, j.created_on)) as last_at,
              (array_agg(j.id::text order by j.created_on desc))[1:500] as ids,
              p.owner, p.repo, p.name as project_name
            from pgboss.job j
            left join projects p on p.id = case when j.data->>'projectId' ~ '^[0-9]+$' then (j.data->>'projectId')::int end
            where j.state = 'failed'
            group by j.name, j.data->>'projectId', 3, p.owner, p.repo, p.name
            order by last_at desc
            limit 50`,
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
    failedGroups: failed.map((f) => ({
      name: f.name,
      data: f.data,
      message: f.message,
      count: f.count,
      firstAt: new Date(f.first_at).toISOString(),
      lastAt: new Date(f.last_at).toISOString(),
      ids: f.ids,
      project: f.owner && f.repo ? { owner: f.owner, repo: f.repo, name: f.project_name ?? f.repo } : null,
    })),
    githubToken: { configured: !!c.GITHUB_TOKEN, ...(rate ?? {}) },
    app: { configured: githubAppConfigured(), webhooks: !!c.GITHUB_WEBHOOK_SECRET, signIn: signInConfigured() },
    syncPaused: settings.syncPaused,
  };
}
