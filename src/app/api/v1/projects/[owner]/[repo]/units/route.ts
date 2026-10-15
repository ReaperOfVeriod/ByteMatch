import type { NextRequest } from "next/server";
import { latestFullReport, loadReport } from "@/db/store";
import { NotFound, resolve } from "@/lib/project-data";

export const dynamic = "force-dynamic";

/** One unit's functions from the latest full report: ?version=...&unit=... */
export async function GET(request: NextRequest, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await ctx.params;
  const q = request.nextUrl.searchParams;
  try {
    const r = await resolve(owner, repo, q.get("version"));
    const row = await latestFullReport(r.project.id, r.version);
    const report = row ? await loadReport(row) : null;
    const unit = report?.units.find((u) => u.name === q.get("unit"));
    if (!unit) throw new NotFound("Unit not found");
    return Response.json(
      {
        name: unit.name,
        source_path: unit.metadata?.source_path ?? null,
        functions: unit.functions.map((f) => ({
          name: f.metadata?.demangled_name ?? f.name,
          size: f.size,
          fuzzy_match_percent: f.fuzzy_match_percent,
          address: f.metadata?.virtual_address ?? null,
        })),
      },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch (e) {
    if (e instanceof NotFound) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
