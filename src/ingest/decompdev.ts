import type { Project } from "../db/schema";
import { reportAt, storeMeasuresOnly, storeReport } from "../db/store";
import { config } from "../lib/config";
import { parseReport } from "../report/parse";
import { MEASURE_KEYS, emptyMeasures, type Measures } from "../report/types";

/**
 * Copies a project's progress history from decomp.dev while it still serves it (the site is being
 * sunset). Only decomp.dev's public JSON endpoints are read: the project, `mode=history` (measures
 * per commit) and `mode=report` (the latest full objdiff report).
 */

interface DecompDevProject {
  default_version?: string | null;
  report_versions?: unknown[];
  commit?: { sha?: string; message?: string | null; timestamp?: string } | null;
}

interface DecompDevHistoryEntry {
  timestamp: string;
  commit_sha: string;
  commit_message?: string | null;
  measures: Record<string, unknown>;
}

export interface ImportResult {
  /** False when decomp.dev never tracked this project: nothing to import, not an error. */
  found: boolean;
  versions: { version: string; history: number; report: boolean }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "ByteMatch history import" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function toMeasures(raw: Record<string, unknown>): Measures {
  const m = emptyMeasures();
  for (const k of MEASURE_KEYS) {
    const v = Number(raw[k] ?? 0);
    m[k] = Number.isFinite(v) ? v : 0;
  }
  return m;
}

/** decomp.dev lists versions as a JSON array that may include a leading count; keep the names. */
export function versionNames(project: DecompDevProject): string[] {
  const names = (project.report_versions ?? []).filter((v): v is string => typeof v === "string");
  if (names.length) return names;
  return project.default_version ? [project.default_version] : [];
}

export async function importFromDecompDev(project: Project): Promise<ImportResult> {
  const base = `${config().DECOMP_DEV_URL.replace(/\/+$/, "")}/${encodeURIComponent(project.owner)}/${encodeURIComponent(project.repo)}`;
  const probe = await fetch(`${base}.json`, {
    headers: { accept: "application/json", "user-agent": "ByteMatch history import" },
    signal: AbortSignal.timeout(60_000),
  });
  // decomp.dev answers 404 for projects it never tracked (and will for all of them once it is gone).
  if (probe.status === 404) return { found: false, versions: [] };
  if (!probe.ok) throw new Error(`${base}.json: HTTP ${probe.status}`);
  const versions = versionNames((await probe.json()) as DecompDevProject);
  if (versions.length === 0) return { found: false, versions: [] };
  const result: ImportResult = { found: true, versions: [] };
  for (const version of versions) {
    const q = `version=${encodeURIComponent(version)}`;
    const entries = await getJson<DecompDevHistoryEntry[]>(`${base}.json?mode=history&${q}`);
    const rows = entries
      .filter((e) => e && typeof e.commit_sha === "string" && e.measures)
      .map((e) => ({
        commit: { sha: e.commit_sha, message: e.commit_message ?? null, timestamp: new Date(e.timestamp) },
        measures: toMeasures(e.measures),
      }));
    const history = await storeMeasuresOnly(project, version, rows);

    // The latest full report, so the unit and function lists are there from day one.
    let report = false;
    const latest = [...rows].sort((a, b) => b.commit.timestamp.getTime() - a.commit.timestamp.getTime())[0];
    if (latest) {
      const existing = await reportAt(project.id, version, latest.commit.sha);
      if (!existing?.blobId) {
        const res = await fetch(`${base}.json?mode=report&${q}`, { signal: AbortSignal.timeout(120_000) });
        if (res.ok) {
          const parsed = parseReport(new Uint8Array(await res.arrayBuffer()));
          await storeReport({ project, version, commit: latest.commit, report: parsed, source: "import" });
          report = true;
        }
      }
    }
    result.versions.push({ version, history, report });
  }
  return result;
}
