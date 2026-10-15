"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProgressBar } from "./progress-bar";

export interface ProjectRow {
  owner: string;
  repo: string;
  name: string;
  platform: string | null;
  platformName: string | null;
  version: string | null;
  codePercent: number | null;
  functions: { done: number; total: number } | null;
  updated: string | null;
}

type Sort = "progress" | "name" | "updated";

const fmt = new Intl.NumberFormat("en-US");

export function ProjectList({ rows }: { rows: ProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const platforms = useMemo(
    () =>
      [...new Map(rows.filter((r) => r.platform).map((r) => [r.platform!, r.platformName ?? r.platform!])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [rows],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) => (!platform || r.platform === platform) && (!q || `${r.name} ${r.owner}/${r.repo}`.toLowerCase().includes(q)),
    );
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "progress"
          ? (b.codePercent ?? -1) - (a.codePercent ?? -1)
          : (b.updated ?? "").localeCompare(a.updated ?? ""),
    );
  }, [rows, query, platform, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          aria-label="Search projects"
          className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Platform"
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm"
        >
          <option value="">All platforms</option>
          {platforms.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort by"
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm"
        >
          <option value="updated">Recently updated</option>
          <option value="progress">Most matched</option>
          <option value="name">Name</option>
        </select>
        <span className="ml-auto text-sm text-ink-3">
          {shown.length} of {rows.length} projects
        </span>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {shown.map((r) => (
          <li key={`${r.owner}/${r.repo}`}>
            <Link
              href={`/${r.owner}/${r.repo}`}
              className="grid gap-x-6 gap-y-2 px-4 py-3 hover:bg-surface-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem]"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {r.owner}/{r.repo}
                  {r.platformName ? ` · ${r.platformName}` : ""}
                  {r.version ? ` · ${r.version}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {r.codePercent === null ? (
                  <span className="text-sm text-ink-3">No reports yet</span>
                ) : (
                  <>
                    <ProgressBar value={r.codePercent} label={`${r.name}: code matched`} />
                    <span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums">{r.codePercent.toFixed(2)}%</span>
                  </>
                )}
              </div>
              <div className="text-sm text-ink-2 sm:text-right">
                {r.functions ? (
                  <span className="font-mono tabular-nums">
                    {fmt.format(r.functions.done)} / {fmt.format(r.functions.total)}
                  </span>
                ) : null}
                <div className="text-xs text-ink-3">functions</div>
              </div>
            </Link>
          </li>
        ))}
        {shown.length === 0 ? <li className="px-4 py-10 text-center text-sm text-ink-3">No projects match.</li> : null}
      </ul>
    </div>
  );
}
