import { gunzipSync, gzipSync } from "node:zlib";
import { and, asc, desc, eq, sql as dsql } from "drizzle-orm";
import { sha256 } from "../lib/crypto";
import { ACCESS_ERROR_PATTERN } from "../lib/visibility";
import { encodeReport, parseReport } from "../report/parse";
import type { Measures, Report } from "../report/types";
import { db } from "./client";
import { projects, reportBlobs, reports, type Project, type ReportRow } from "./schema";

export interface CommitInfo {
  sha: string;
  message?: string | null;
  timestamp: Date;
}

export interface StoreInput {
  project: Project;
  version: string;
  commit: CommitInfo;
  report: Report;
  source: "artifact" | "upload" | "import";
  runId?: number | null;
}

/** Saves one version's report at one commit (replacing an earlier one for the same commit). */
export async function storeReport(input: StoreInput): Promise<ReportRow> {
  const { project, version, commit, report } = input;
  const encoded = encodeReport(report);
  const hash = sha256(encoded);
  const d = db();
  return d.transaction(async (tx) => {
    let [blob] = await tx.select({ id: reportBlobs.id }).from(reportBlobs).where(eq(reportBlobs.sha256, hash));
    if (!blob) {
      [blob] = await tx
        .insert(reportBlobs)
        .values({ sha256: hash, data: gzipSync(encoded, { level: 9 }), size: encoded.length })
        .onConflictDoUpdate({ target: reportBlobs.sha256, set: { sha256: hash } })
        .returning({ id: reportBlobs.id });
    }
    const values = {
      projectId: project.id,
      version,
      commitSha: commit.sha,
      commitMessage: commit.message ?? null,
      commitTimestamp: commit.timestamp,
      source: input.source,
      runId: input.runId ?? null,
      measures: report.measures,
      categories: report.categories.map(({ id, name, measures }) => ({ id, name, measures })),
      blobId: blob.id,
    };
    const [row] = await tx
      .insert(reports)
      .values(values)
      .onConflictDoUpdate({ target: [reports.projectId, reports.version, reports.commitSha], set: { ...values, createdAt: new Date() } })
      .returning();
    await tx.update(projects).set({ lastError: null, lastErrorAt: null, updatedAt: new Date() }).where(eq(projects.id, project.id));
    return row;
  });
}

/** History rows that carry only measures (decomp.dev imports); never overwrite a real report. */
export async function storeMeasuresOnly(project: Project, version: string, rows: { commit: CommitInfo; measures: Measures }[]) {
  if (rows.length === 0) return 0;
  const inserted = await db()
    .insert(reports)
    .values(
      rows.map((r) => ({
        projectId: project.id,
        version,
        commitSha: r.commit.sha,
        commitMessage: r.commit.message ?? null,
        commitTimestamp: r.commit.timestamp,
        source: "import",
        measures: r.measures,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: reports.id });
  return inserted.length;
}

/** Recently decoded full reports, by blob id (blobs never change, so entries never go stale). */
const reportCache = new Map<number, Report>();
const REPORT_CACHE_SIZE = 8;

export async function loadReport(row: Pick<ReportRow, "blobId">): Promise<Report | null> {
  if (!row.blobId) return null;
  const hit = reportCache.get(row.blobId);
  if (hit) {
    reportCache.delete(row.blobId);
    reportCache.set(row.blobId, hit);
    return hit;
  }
  const [blob] = await db().select({ data: reportBlobs.data }).from(reportBlobs).where(eq(reportBlobs.id, row.blobId));
  if (!blob) return null;
  const report = parseReport(gunzipSync(blob.data));
  reportCache.set(row.blobId, report);
  if (reportCache.size > REPORT_CACHE_SIZE) reportCache.delete(reportCache.keys().next().value!);
  return report;
}

export async function findProject(owner: string, repo: string): Promise<Project | undefined> {
  const [p] = await db()
    .select()
    .from(projects)
    .where(and(dsql`lower(${projects.owner}) = lower(${owner})`, dsql`lower(${projects.repo}) = lower(${repo})`));
  return p;
}

/** Versions with at least one report, most recently updated first. */
export async function projectVersions(projectId: number): Promise<{ version: string; latest: Date }[]> {
  const rows = await db()
    .select({ version: reports.version, latest: dsql<Date>`max(${reports.commitTimestamp})` })
    .from(reports)
    .where(eq(reports.projectId, projectId))
    .groupBy(reports.version)
    .orderBy(desc(dsql`max(${reports.commitTimestamp})`));
  return rows.map((r) => ({ version: r.version, latest: new Date(r.latest) }));
}

/** The version a page or badge shows when none is asked for. */
export async function defaultVersion(project: Project): Promise<string | undefined> {
  if (project.defaultVersion) return project.defaultVersion;
  return (await projectVersions(project.id))[0]?.version;
}

/** Whether any of the project's history came from a decomp.dev import. */
export async function hasImportedHistory(projectId: number): Promise<boolean> {
  const [row] = await db()
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.source, "import")))
    .limit(1);
  return !!row;
}

export async function latestReport(projectId: number, version: string): Promise<ReportRow | undefined> {
  const [row] = await db()
    .select()
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.version, version)))
    .orderBy(desc(reports.commitTimestamp), desc(reports.id))
    .limit(1);
  return row;
}

/** The latest report for a version that still has its full report stored. */
export async function latestFullReport(projectId: number, version: string): Promise<ReportRow | undefined> {
  const [row] = await db()
    .select()
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.version, version), dsql`${reports.blobId} is not null`))
    .orderBy(desc(reports.commitTimestamp), desc(reports.id))
    .limit(1);
  return row;
}

export async function reportAt(projectId: number, version: string, commitSha: string): Promise<ReportRow | undefined> {
  const [row] = await db()
    .select()
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.version, version), eq(reports.commitSha, commitSha)));
  return row;
}

/** The report at a commit, by full SHA or a unique prefix of at least 7 characters. */
export async function reportAtPrefix(projectId: number, version: string, sha: string): Promise<ReportRow | undefined> {
  const clean = sha.toLowerCase();
  if (!/^[0-9a-f]{7,64}$/.test(clean)) return undefined;
  const rows = await db()
    .select()
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.version, version), dsql`${reports.commitSha} like ${clean + "%"}`))
    .limit(2);
  return rows.length === 1 ? rows[0] : undefined;
}

export async function history(projectId: number, version: string) {
  return db()
    .select({
      commitSha: reports.commitSha,
      commitMessage: reports.commitMessage,
      commitTimestamp: reports.commitTimestamp,
      measures: reports.measures,
      categories: reports.categories,
    })
    .from(reports)
    .where(and(eq(reports.projectId, projectId), eq(reports.version, version)))
    .orderBy(asc(reports.commitTimestamp), asc(reports.id));
}

/** Game and franchise names already in use, offered as suggestions so projects agree on spelling. */
export async function gameNames(): Promise<{ games: string[]; franchises: string[] }> {
  const rows = await db()
    .selectDistinct({ game: projects.game, franchise: projects.franchise })
    .from(projects)
    .where(eq(projects.enabled, true));
  const uniq = (v: (string | null)[]) => [...new Set(v.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  return { games: uniq(rows.map((r) => r.game)), franchises: uniq(rows.map((r) => r.franchise)) };
}

/** Every enabled project with its default version's latest measures, for the index. */
export async function projectIndex() {
  const rows = await db().execute<{
    id: number;
    owner: string;
    repo: string;
    name: string;
    short_name: string | null;
    platform: string | null;
    game: string | null;
    franchise: string | null;
    release_year: number | null;
    version: string | null;
    measures: Measures | null;
    commit_timestamp: string | null;
    image_url: string | null;
    icon_url: string | null;
    created_at: string;
    /** Matched-code percentage points gained over the last 30 days (since the first report if newer). */
    gain_30d: number | null;
  }>(dsql`
    select p.id, p.owner, p.repo, p.name, p.short_name, p.platform, p.game, p.franchise, p.release_year, p.image_url, p.icon_url, p.created_at,
           r.version, r.measures, r.commit_timestamp,
           (r.measures->>'matched_code_percent')::float8 - (b.measures->>'matched_code_percent')::float8 as gain_30d
    from ${projects} p
    left join lateral (
      select version, measures, commit_timestamp from ${reports} r
      where r.project_id = p.id
        and r.version = coalesce(p.default_version, (
          select version from ${reports} x where x.project_id = p.id order by commit_timestamp desc limit 1))
      order by commit_timestamp desc, id desc limit 1
    ) r on true
    left join lateral (
      select measures from ${reports} o
      where o.project_id = p.id and o.version = r.version
      order by (o.commit_timestamp <= now() - interval '30 days') desc,
               case when o.commit_timestamp <= now() - interval '30 days' then o.commit_timestamp end desc nulls last,
               o.commit_timestamp asc
      limit 1
    ) b on true
    where p.enabled
      and (p.last_error is null or (r.version is not null and p.last_error !~* ${ACCESS_ERROR_PATTERN}))
    order by lower(p.name)`);
  return [...rows];
}

/** Drops full reports older than DAYS, keeping each version's latest; measures stay. */
export async function pruneReports(days: number): Promise<number> {
  if (days <= 0) return 0;
  const result = await db().execute(dsql`
    update ${reports} r set blob_id = null
    where r.blob_id is not null
      and r.commit_timestamp < now() - make_interval(days => ${days})
      and r.id <> (select id from ${reports} l where l.project_id = r.project_id and l.version = r.version
                   order by commit_timestamp desc, id desc limit 1)`);
  await db().execute(dsql`delete from ${reportBlobs} b where not exists (select 1 from ${reports} r where r.blob_id = b.id)`);
  return result.count ?? 0;
}
