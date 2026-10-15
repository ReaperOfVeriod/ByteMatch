import { gunzipSync } from "node:zlib";
import type { NextRequest } from "next/server";
import { findProject, storeReport, type StoreInput } from "@/db/store";
import { readArtifact } from "@/github/artifacts";
import { readFunctional, versionsOf } from "@/ingest/github";
import { ReportProblem } from "@/lib/problems";
import { config } from "@/lib/config";
import { projectUrl } from "@/lib/project-data";
import { checkToken } from "@/lib/tokens";
import { parseReport, ReportError } from "@/report/parse";

export const runtime = "nodejs";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Upload API: POST the raw objdiff report (JSON or protobuf, optionally gzip-encoded) with
 * `Authorization: Bearer bm_...` and ?version=...&commit=<sha>[&commit_message=...][&commit_timestamp=ISO].
 * Or POST a zip laid out like a CI artifact: the report, and optionally functional.json/.tsv.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await ctx.params;
  const project = await findProject(owner, repo);
  if (!project || !project.enabled) return fail(404, "Project not found");
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1];
  if (!token || !(await checkToken(project, token))) return fail(401, "Missing or invalid upload token");

  const q = request.nextUrl.searchParams;
  const commit = q.get("commit")?.trim();
  if (!commit || !/^[0-9a-f]{7,64}$/i.test(commit)) return fail(400, "commit must be the commit SHA");
  const version = q.get("version")?.trim();
  if (!version && !project.splitVersions) return fail(400, "version is required");
  const timestamp = q.get("commit_timestamp") ? new Date(q.get("commit_timestamp")!) : new Date();
  if (Number.isNaN(timestamp.getTime())) return fail(400, "commit_timestamp must be ISO-8601");

  const limit = config().MAX_REPORT_BYTES;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) return fail(413, `report is larger than ${limit} bytes`);
  let body = new Uint8Array(await request.arrayBuffer());
  if (request.headers.get("content-encoding")?.toLowerCase() === "gzip" || (body[0] === 0x1f && body[1] === 0x8b)) {
    try {
      body = new Uint8Array(gunzipSync(body, { maxOutputLength: limit }));
    } catch {
      return fail(400, "body is not valid gzip, or unpacks past the size limit");
    }
  }
  if (body.length > limit) return fail(413, `report is larger than ${limit} bytes`);

  let report;
  let functional: StoreInput["functional"] = null;
  try {
    if (body[0] === 0x50 && body[1] === 0x4b) {
      // A zip, like a CI artifact.
      const files = readArtifact(body);
      report = parseReport(files.report);
      functional = readFunctional(files.functional);
    } else {
      report = parseReport(body);
    }
  } catch (e) {
    return fail(400, e instanceof ReportError || e instanceof ReportProblem ? e.message : "could not read the report");
  }
  const stored: string[] = [];
  for (const [v, part] of versionsOf(project, version ?? "default", report)) {
    await storeReport({
      project,
      version: v,
      commit: { sha: commit.toLowerCase(), message: q.get("commit_message"), timestamp },
      report: part,
      source: "upload",
      functional,
    });
    stored.push(v);
  }
  return Response.json(
    { stored, url: projectUrl(project), ...(functional && !(functional instanceof Map) ? { functional_error: functional.error } : {}) },
    { status: 201 },
  );
}
