import { gunzipSync } from "node:zlib";
import type { Project } from "../db/schema";
import { storeMeasuresOnly, type CommitInfo } from "../db/store";
import type { Measures } from "../report/types";
import { toMeasures } from "./decompdev";

/**
 * History files: a project's progress over time, one entry per commit, in the format decomp.dev's
 * `/{owner}/{repo}.json?mode=history` served (and ByteMatch serves at the same URL):
 *
 *   [{ "timestamp": "2026-01-02T03:04:05Z", "commit_sha": "…", "commit_message": "…", "measures": { … } }, …]
 *
 * Maintainers upload one per version, so history saved from decomp.dev (or another ByteMatch)
 * outlives the site it came from. Uploaded entries fill gaps only: they never replace a commit
 * that already has a report.
 */

/** Largest history file accepted, unpacked. decomp.dev's biggest were a few megabytes. */
export const MAX_HISTORY_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 200_000;

export class HistoryError extends Error {}

export interface HistoryRow {
  commit: CommitInfo;
  measures: Measures;
}

/** Reads a history file (JSON, optionally gzipped) into rows, newest first or not; throws HistoryError. */
export function parseHistory(input: Uint8Array): HistoryRow[] {
  let bytes = input;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = new Uint8Array(gunzipSync(bytes, { maxOutputLength: MAX_HISTORY_BYTES }));
    } catch {
      throw new HistoryError("The file is not valid gzip, or unpacks past the size limit.");
    }
  }
  if (bytes.length > MAX_HISTORY_BYTES) throw new HistoryError(`History files are limited to ${MAX_HISTORY_BYTES / 1024 / 1024} MiB.`);
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HistoryError("The file is not JSON. Upload the output of …/{owner}/{repo}.json?mode=history.");
  }
  // Accept the bare array, or an object wrapping it ({ "history": [...] }).
  const list = Array.isArray(data) ? data : (data as { history?: unknown })?.history;
  if (!Array.isArray(list)) throw new HistoryError("Expected a JSON array of history entries.");
  if (list.length > MAX_ENTRIES) throw new HistoryError(`At most ${MAX_ENTRIES.toLocaleString("en-US")} entries per file.`);

  const rows = new Map<string, HistoryRow>();
  list.forEach((e: unknown, i) => {
    const entry = e as { timestamp?: unknown; commit_sha?: unknown; commit_message?: unknown; measures?: unknown };
    const where = `Entry ${i + 1}`;
    if (!entry || typeof entry !== "object") throw new HistoryError(`${where} is not an object.`);
    if (typeof entry.commit_sha !== "string" || !/^[0-9a-f]{7,64}$/i.test(entry.commit_sha))
      throw new HistoryError(`${where}: commit_sha must be a commit SHA.`);
    const timestamp = typeof entry.timestamp === "string" ? new Date(entry.timestamp) : new Date(NaN);
    if (Number.isNaN(timestamp.getTime())) throw new HistoryError(`${where}: timestamp must be an ISO-8601 date.`);
    if (!entry.measures || typeof entry.measures !== "object" || Array.isArray(entry.measures))
      throw new HistoryError(`${where}: measures must be an object.`);
    const sha = entry.commit_sha.toLowerCase();
    rows.set(sha, {
      commit: { sha, message: typeof entry.commit_message === "string" ? entry.commit_message : null, timestamp },
      measures: toMeasures(entry.measures as Record<string, unknown>),
    });
  });
  if (rows.size === 0) throw new HistoryError("The file has no history entries.");
  return [...rows.values()];
}

/** Stores ROWS for VERSION; returns how many commits were new (the rest already had data). */
export async function storeHistory(project: Project, version: string, rows: HistoryRow[]): Promise<{ added: number; skipped: number }> {
  const added = await storeMeasuresOnly(project, version, rows, "history");
  return { added, skipped: rows.length - added };
}

/** Version names: what objdiff and artifact names use, without path or control characters. */
export function checkVersion(input: string): string | null {
  const v = input.trim();
  return /^[\w.+-]{1,64}$/.test(v) ? v : null;
}
