import type { Project } from "../db/schema";
import { repoClient } from "../github/client";
import { cleanSourcePath, findFunction, type FoundFunction } from "./source";

/**
 * A project's source, read from GitHub at the commit a report came from. Files at a commit never
 * change, so what's fetched is kept (by size, up to a budget) and asked for once.
 */

const MAX_FILE = 1_000_000;
const MAX_DIR_FILES = 200;
const MAX_DIR_BYTES = 8_000_000;
const SOURCE_EXT = /\.(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|inc|inl|s|asm)$/i;

class ByteCache {
  private map = new Map<string, string | null>();
  private bytes = 0;
  constructor(private readonly budget: number) {}
  get(k: string) {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: string | null) {
    this.bytes -= this.map.get(k)?.length ?? 0;
    this.map.delete(k);
    this.map.set(k, v);
    this.bytes += v?.length ?? 0;
    for (const [old, ov] of this.map) {
      if (this.bytes <= this.budget) break;
      this.map.delete(old);
      this.bytes -= ov?.length ?? 0;
    }
  }
}

const files = new ByteCache(64_000_000);
const listings = new Map<string, string[] | null>();
/** Which file in a directory a function was found in, per repository commit. */
const located = new Map<string, string>();

type Repo = Pick<Project, "owner" | "repo" | "installationId">;
const repoKey = (p: Repo, sha: string) => `${p.owner}/${p.repo}@${sha}`;

/** A file's text at SHA; null when it doesn't exist (or is a directory, or too big). */
async function fileAt(p: Repo, sha: string, path: string): Promise<string | null> {
  const key = `${repoKey(p, sha)}:${path}`;
  const hit = files.get(key);
  if (hit !== undefined) return hit;
  let text: string | null = null;
  // Public repositories: the raw host, which costs no API allowance.
  const raw = await fetch(
    `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => null);
  if (raw?.ok) {
    text = Number(raw.headers.get("content-length") ?? 0) > MAX_FILE ? null : await raw.text();
  } else if (raw && raw.status !== 404) {
    throw new Error(`GitHub answered ${raw.status} for ${path}`);
  } else {
    // Not public, or not a file: ask the API, which also reaches private repositories.
    try {
      const { octokit } = await repoClient(p);
      const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: p.owner,
        repo: p.repo,
        path,
        ref: sha,
        headers: { accept: "application/vnd.github.raw+json" },
      });
      text = typeof data === "string" ? data : null;
    } catch {
      text = null;
    }
  }
  if (text && text.length > MAX_FILE) text = null;
  files.set(key, text);
  return text;
}

/** Source files directly in a directory at SHA; null when it isn't one. */
async function listDir(p: Repo, sha: string, path: string): Promise<string[] | null> {
  const key = `${repoKey(p, sha)}:${path}/`;
  if (listings.has(key)) return listings.get(key)!;
  let out: string[] | null = null;
  try {
    const { octokit } = await repoClient(p);
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", { owner: p.owner, repo: p.repo, path, ref: sha });
    if (Array.isArray(data)) {
      out = data
        .filter((e) => e.type === "file" && SOURCE_EXT.test(e.name) && e.size <= MAX_FILE)
        .map((e) => e.path)
        .slice(0, MAX_DIR_FILES);
    }
  } catch {
    out = null;
  }
  if (listings.size > 2000) listings.clear();
  listings.set(key, out);
  return out;
}

export interface SourceView {
  /** The file shown (for a directory unit, the file the function was found in). */
  path: string;
  /** GitHub's page for it at the commit, with the lines if known. */
  url: string;
  kind: "c" | "asm" | "file" | "not-found" | "directory";
  /** 1-based, inclusive: the lines `code` holds, out of the file's `lines`. */
  start: number;
  end: number;
  lines: number;
  code: string;
  /** For a directory unit shown whole: its source files. */
  files?: { path: string; url: string }[];
}

const blob = (p: Repo, sha: string, path: string, start?: number, end?: number) =>
  `https://github.com/${p.owner}/${p.repo}/blob/${sha}/${path.split("/").map(encodeURIComponent).join("/")}${
    start ? `#L${start}${end && end !== start ? `-L${end}` : ""}` : ""
  }`;

const MAX_SHOWN_LINES = 4000;

function view(p: Repo, sha: string, path: string, text: string, found: FoundFunction | null, fn: string | null): SourceView {
  const lines = text.split("\n");
  if (fn && found) {
    // Assembly includes get a little context around them.
    const start = found.kind === "asm" ? Math.max(1, found.start - 2) : found.start;
    const end = found.kind === "asm" ? Math.min(lines.length, found.end + 2) : found.end;
    return {
      path,
      url: blob(p, sha, path, found.start, found.end),
      kind: found.kind,
      start,
      end,
      lines: lines.length,
      code: lines.slice(start - 1, end).join("\n"),
    };
  }
  const end = Math.min(lines.length, MAX_SHOWN_LINES);
  return {
    path,
    url: blob(p, sha, path),
    kind: fn ? "not-found" : "file",
    start: 1,
    end,
    lines: lines.length,
    code: lines.slice(0, end).join("\n"),
  };
}

/**
 * The order to search a directory in. Files named after the function come first. Then, when file
 * names carry the address their code starts at (`vendor_002CF2C0.c`, as split decompilations name
 * them) and the function's name carries its own, the file starting nearest below it, which is
 * nearly always the one; the rest after.
 */
export function candidates(paths: string[], fn: string): string[] {
  const hexOf = (s: string) => {
    const all = s.match(/[0-9A-Fa-f]{6,8}/g);
    return all ? parseInt(all[all.length - 1], 16) : null;
  };
  const target = hexOf(fn);
  const lower = fn.toLowerCase();
  const rank = (p: string): [number, number] => {
    const base = p.split("/").pop()!.toLowerCase();
    if (base.startsWith(lower)) return [0, 0];
    const at = hexOf(base.replace(/\.[^.]+$/, ""));
    if (target !== null && at !== null && at <= target) return [1, target - at];
    return [2, 0];
  };
  return [...paths].sort((x, y) => {
    const [a1, a2] = rank(x);
    const [b1, b2] = rank(y);
    return a1 - b1 || a2 - b2;
  });
}

/**
 * A unit's source at SHA: the whole file, or one function in it. SOURCE_PATH is the report's
 * source_path for the unit, which may be a file or a directory.
 */
export async function loadSource(p: Repo, sha: string, sourcePath: string, fn: string | null): Promise<SourceView | null> {
  const path = cleanSourcePath(sourcePath);
  if (!path) return null;
  const text = await fileAt(p, sha, path);
  if (text !== null) return view(p, sha, path, text, fn ? findFunction(text, fn) : null, fn);

  const dir = await listDir(p, sha, path);
  if (!dir) return null;
  if (!fn) {
    return {
      path,
      url: blob(p, sha, path).replace("/blob/", "/tree/"),
      kind: "directory",
      start: 0,
      end: 0,
      lines: 0,
      code: "",
      files: dir.map((f) => ({ path: f, url: blob(p, sha, f) })),
    };
  }
  const known = located.get(`${repoKey(p, sha)}:${path}:${fn}`);
  const order = known ? [known, ...dir.filter((d) => d !== known)] : candidates(dir, fn);
  let budget = MAX_DIR_BYTES;
  // A few at a time: the answer is usually in the first files tried.
  for (let i = 0; i < order.length && budget > 0; i += 6) {
    const batch = await Promise.all(order.slice(i, i + 6).map(async (f) => [f, await fileAt(p, sha, f)] as const));
    for (const [f, t] of batch) {
      if (t === null) continue;
      budget -= t.length;
      const found = findFunction(t, fn);
      if (found) {
        if (located.size > 20_000) located.clear();
        located.set(`${repoKey(p, sha)}:${path}:${fn}`, f);
        return view(p, sha, f, t, found, fn);
      }
    }
  }
  return { path, url: blob(p, sha, path).replace("/blob/", "/tree/"), kind: "not-found", start: 0, end: 0, lines: 0, code: "" };
}
