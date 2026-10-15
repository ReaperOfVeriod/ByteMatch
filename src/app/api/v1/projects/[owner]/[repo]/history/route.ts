import type { NextRequest } from "next/server";
import { findProject } from "@/db/store";
import { checkVersion, HistoryError, MAX_HISTORY_BYTES, parseHistory, storeHistory } from "@/ingest/history";
import { projectUrl } from "@/lib/project-data";
import { checkToken } from "@/lib/tokens";

export const runtime = "nodejs";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * History upload: POST a history file (the JSON decomp.dev served at `/{owner}/{repo}.json?mode=history`,
 * optionally gzipped) with `Authorization: Bearer bm_...` and ?version=... . Commits that already
 * have data are left alone, so uploading the same file twice is harmless.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await ctx.params;
  const project = await findProject(owner, repo);
  if (!project || !project.enabled) return fail(404, "Project not found");
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !(await checkToken(project, token))) return fail(401, "Missing or invalid upload token");

  const version = checkVersion(request.nextUrl.searchParams.get("version") ?? "");
  if (!version) return fail(400, "version is required (letters, digits, . _ + -)");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_HISTORY_BYTES) return fail(413, "history file is too large");

  let rows;
  try {
    rows = parseHistory(new Uint8Array(await request.arrayBuffer()));
  } catch (e) {
    return fail(e instanceof HistoryError ? 400 : 500, e instanceof HistoryError ? e.message : "could not read the history file");
  }
  const { added, skipped } = await storeHistory(project, version, rows);
  return Response.json({ version, added, skipped, url: projectUrl(project) }, { status: 201 });
}
