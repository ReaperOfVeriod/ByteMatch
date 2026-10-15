import type { NextRequest } from "next/server";
import { renderBadge, parseStyle, shieldsEndpoint } from "@/badge/badge";
import { badgePng } from "@/badge/png";
import { history, loadReport } from "@/db/store";
import { BadRequest, badgeText, NotFound, projectJson, resolve } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Badges are embedded in READMEs (GitHub's camo proxy honours these); data is cheap to refetch. */
const BADGE_CACHE = "public, max-age=60, s-maxage=60, stale-while-revalidate=600";
const DATA_CACHE = "public, max-age=60, s-maxage=60";

function error(status: number, message: string, format: string) {
  if (format === "svg" || format === "png") {
    const svg = renderBadge({ label: "ByteMatch", message: message.toLowerCase().slice(0, 40), color: "lightgrey" });
    if (format === "png")
      return new Response(Buffer.from(badgePng(svg)), { status, headers: { "content-type": "image/png", "cache-control": "no-store" } });
    return new Response(svg, { status, headers: { "content-type": "image/svg+xml", "cache-control": "no-store" } });
  }
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ owner: string; repo: string; format: string }> }) {
  const { owner, repo, format } = await ctx.params;
  const q = request.nextUrl.searchParams;
  try {
    if (!["json", "svg", "png"].includes(format)) throw new NotFound("Not found");
    const r = await resolve(owner, repo, q.get("version"), q.get("category"));
    const mode = (q.get("mode") ?? (format === "json" ? "" : "shield")).toLowerCase();

    if (format === "json") {
      const headers = { "cache-control": DATA_CACHE, "access-control-allow-origin": "*" };
      switch (mode) {
        case "":
          return Response.json(projectJson(r), { headers });
        case "shield":
          return Response.json(shieldsEndpoint({ ...badgeText(r, q), color: q.get("color") ?? "informational" }), { headers });
        case "measures":
          return Response.json(r.measures, { headers });
        case "history": {
          const rows = await history(r.project.id, r.version);
          const category = r.category?.id;
          return Response.json(
            rows
              .reverse()
              .map((h) => ({
                timestamp: h.commitTimestamp.toISOString(),
                commit_sha: h.commitSha,
                commit_message: h.commitMessage,
                measures: category ? (h.categories.find((c) => c.id === category)?.measures ?? null) : h.measures,
              }))
              .filter((h) => h.measures),
            { headers },
          );
        }
        case "report": {
          const report = await loadReport(r.row);
          if (!report) throw new NotFound("The full report for this commit is no longer stored");
          return Response.json(report, { headers });
        }
        default:
          throw new BadRequest(`Unknown mode "${mode}". Try shield, history, report or measures.`);
      }
    }

    if (mode !== "shield") throw new BadRequest(`Unknown mode "${mode}" for a badge. Use mode=shield.`);
    const style = parseStyle(q.get("style"));
    if (!style) throw new BadRequest(`Unknown style "${q.get("style")}". Try flat, flat-square, plastic or for-the-badge.`);
    const svg = renderBadge({
      ...badgeText(r, q),
      color: q.get("color") ?? undefined,
      labelColor: q.get("labelColor") ?? q.get("label_color") ?? undefined,
      style,
    });
    if (format === "png")
      return new Response(Buffer.from(badgePng(svg)), { headers: { "content-type": "image/png", "cache-control": BADGE_CACHE } });
    return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": BADGE_CACHE } });
  } catch (e) {
    if (e instanceof NotFound) return error(404, e.message, format);
    if (e instanceof BadRequest) return error(400, e.message, format);
    console.error(e);
    return error(500, "Something went wrong", format);
  }
}
