import type { Project, ReportRow } from "../db/schema";
import { defaultVersion, findProject, latestReport, projectVersions } from "../db/store";
import { BADGE_MEASURES } from "../report/measures";
import type { Measures } from "../report/types";
import { config } from "./config";

/** A project with one version (and maybe one category) picked, as the public endpoints need it. */
export interface Resolved {
  project: Project;
  versions: string[];
  version: string;
  row: ReportRow;
  category?: { id: string; name: string; measures: Measures };
  measures: Measures;
}

export class NotFound extends Error {}
export class BadRequest extends Error {}

export async function resolve(owner: string, repo: string, version?: string | null, category?: string | null): Promise<Resolved> {
  const project = await findProject(owner, repo);
  if (!project || !project.enabled) throw new NotFound("Project not found");
  const versions = (await projectVersions(project.id)).map((v) => v.version);
  const picked = version || (await defaultVersion(project));
  if (!picked || !versions.includes(picked)) throw new NotFound(version ? `Version ${version} not found` : "No reports yet");
  const row = await latestReport(project.id, picked);
  if (!row) throw new NotFound("No reports yet");
  const catId = category ?? project.defaultCategory;
  let cat: Resolved["category"];
  if (catId) {
    cat = row.categories.find((c) => c.id === catId);
    if (!cat && category) throw new NotFound(`Category ${category} not found`);
  }
  return { project, versions, version: picked, row, category: cat, measures: cat?.measures ?? row.measures };
}

export const repoUrl = (p: Pick<Project, "owner" | "repo">) => `https://github.com/${p.owner}/${p.repo}`;
export const projectUrl = (p: Pick<Project, "owner" | "repo">, version?: string) =>
  `${config().PUBLIC_URL}/${p.owner}/${p.repo}${version ? `/${encodeURIComponent(version)}` : ""}`;

/** The project JSON decomp.dev served at /{owner}/{repo}.json, field for field. */
export function projectJson(r: Resolved) {
  const { project, row } = r;
  return {
    id: project.githubId ?? project.id,
    owner: project.owner,
    repo: project.repo,
    repo_url: repoUrl(project),
    name: project.name,
    short_name: project.shortName,
    platform: project.platform,
    default_version: project.defaultVersion ?? r.versions[0] ?? null,
    default_category: project.defaultCategory,
    commit: { sha: row.commitSha, message: row.commitMessage, timestamp: row.commitTimestamp.toISOString() },
    measures: r.measures,
    report_versions: r.versions,
    report_categories: row.categories.map((c) => ({ id: c.id, name: c.name, measures: c.measures })),
  };
}

export function badgeText(r: Resolved, params: URLSearchParams): { label: string; message: string } {
  const measure = params.get("measure") ?? "matched_code_percent";
  const format = BADGE_MEASURES[measure];
  if (!format) throw new BadRequest(`Unknown measure "${measure}". Try one of: ${Object.keys(BADGE_MEASURES).join(", ")}`);
  const label = params.get("label") ?? r.category?.name ?? r.project.name;
  const m = r.measures;
  const message =
    format.kind === "percent"
      ? `${m[format.key].toFixed(2)}%`
      : `${new Intl.NumberFormat("en-US").format(m[format.done])} / ${new Intl.NumberFormat("en-US").format(m[format.total])}`;
  return { label, message };
}
