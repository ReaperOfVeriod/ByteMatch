import { projectIndex } from "@/db/store";
import { projectUrl } from "@/lib/project-data";

export const dynamic = "force-dynamic";

/** Every project with its default version's latest measures. */
export async function GET() {
  const rows = await projectIndex();
  return Response.json(
    rows.map((p) => ({
      owner: p.owner,
      repo: p.repo,
      name: p.name,
      short_name: p.short_name,
      platform: p.platform,
      url: projectUrl(p),
      version: p.version,
      timestamp: p.commit_timestamp ? new Date(p.commit_timestamp).toISOString() : null,
      measures: p.measures,
    })),
    { headers: { "cache-control": "public, max-age=60", "access-control-allow-origin": "*" } },
  );
}
