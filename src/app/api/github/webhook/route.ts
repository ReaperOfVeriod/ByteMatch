import { verify } from "@octokit/webhooks-methods";
import { eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { fromWorkflow } from "@/github/artifacts";
import { config } from "@/lib/config";
import { enqueue, JOBS } from "@/lib/queue";

export const runtime = "nodejs";

interface Repo {
  id: number;
  name: string;
  full_name?: string;
  owner?: { login: string };
}

/**
 * GitHub App webhooks: workflow_run (ingest default-branch runs, comment on PR runs),
 * installation / installation_repositories (link projects to the installation) and
 * repository (follow renames and transfers).
 */
export async function POST(request: NextRequest) {
  const secret = config().GITHUB_WEBHOOK_SECRET;
  if (!secret) return new Response("webhooks are not configured", { status: 503 });
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!signature || !(await verify(secret, body, signature).catch(() => false))) return new Response("bad signature", { status: 401 });

  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(body);

  switch (event) {
    case "ping":
      return Response.json({ ok: true });

    case "workflow_run": {
      if (payload.action !== "completed" || payload.workflow_run?.conclusion !== "success") break;
      const run = payload.workflow_run;
      const [project] = await db().select().from(projects).where(eq(projects.githubId, payload.repository.id));
      if (!project?.enabled || !fromWorkflow(run, project.workflow)) break;
      if (payload.installation?.id && payload.installation.id !== project.installationId) {
        await db().update(projects).set({ installationId: payload.installation.id }).where(eq(projects.id, project.id));
      }
      const isPr = String(run.event).startsWith("pull_request");
      if (isPr) {
        if (project.prComments) await enqueue(JOBS.prComment, { projectId: project.id, runId: run.id }, `pr:${project.id}:${run.id}`);
      } else if (run.head_branch === project.defaultBranch) {
        await enqueue(JOBS.ingestRun, { projectId: project.id, runId: run.id }, `run:${project.id}:${run.id}`);
      }
      break;
    }

    case "installation":
    case "installation_repositories": {
      const id: number = payload.installation.id;
      const added: Repo[] = [...(payload.repositories ?? []), ...(payload.repositories_added ?? [])];
      const removed: Repo[] = payload.action === "deleted" ? (payload.repositories ?? []) : (payload.repositories_removed ?? []);
      if (added.length && payload.action !== "deleted") {
        await db()
          .update(projects)
          .set({ installationId: id })
          .where(
            inArray(
              projects.githubId,
              added.map((r) => r.id),
            ),
          );
      }
      if (removed.length) {
        await db()
          .update(projects)
          .set({ installationId: null })
          .where(
            inArray(
              projects.githubId,
              removed.map((r) => r.id),
            ),
          );
      }
      break;
    }

    case "repository": {
      if (payload.action !== "renamed" && payload.action !== "transferred") break;
      const repo: Repo = payload.repository;
      await db()
        .update(projects)
        .set({ owner: repo.owner?.login ?? repo.full_name!.split("/")[0], repo: repo.name, updatedAt: new Date() })
        .where(eq(projects.githubId, repo.id));
      break;
    }
  }
  return Response.json({ ok: true });
}
