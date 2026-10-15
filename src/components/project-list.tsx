"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalImage } from "./external-image";
import { ProgressBar } from "./progress-bar";
import { Search } from "./ui/icons";
import { Select } from "./ui/select";

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
  image: string | null;
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
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="field pl-10"
          />
        </div>
        <Select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
          <option value="">All platforms</option>
          {platforms.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
          <option value="updated">Recently updated</option>
          <option value="progress">Most matched</option>
          <option value="name">Name</option>
        </Select>
      </div>
      <p className="mb-3 text-xs text-ink-3">
        {shown.length} of {rows.length} projects
      </p>

      <ul className="panel divide-y divide-line overflow-hidden">
        {shown.map((r) => (
          <li key={`${r.owner}/${r.repo}`}>
            <Link
              href={`/${r.owner}/${r.repo}`}
              className="grid gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                {r.image ? (
                  <ExternalImage
                    src={r.image}
                    className="size-11 shrink-0 rounded-lg border border-line object-cover"
                    fallback={
                      <div
                        className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-sm font-semibold text-ink-3"
                        aria-hidden
                      >
                        {r.name.slice(0, 1)}
                      </div>
                    }
                  />
                ) : (
                  <div
                    className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-sm font-semibold text-ink-3"
                    aria-hidden
                  >
                    {r.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-xs text-ink-3">
                    {r.owner}/{r.repo}
                    {r.platformName ? ` · ${r.platformName}` : ""}
                    {r.version ? ` · ${r.version}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {r.codePercent === null ? (
                  <span className="text-sm text-ink-3">No reports yet</span>
                ) : (
                  <>
                    <ProgressBar value={r.codePercent} label={`${r.name}: code matched`} />
                    <span className="w-16 shrink-0 text-right font-mono text-sm">{r.codePercent.toFixed(2)}%</span>
                  </>
                )}
              </div>
              <div className="text-sm text-ink-2 sm:text-right">
                {r.functions ? (
                  <span className="font-mono">
                    {fmt.format(r.functions.done)} / {fmt.format(r.functions.total)}
                  </span>
                ) : null}
                <div className="text-xs text-ink-3">functions</div>
              </div>
            </Link>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="px-5 py-12 text-center text-sm text-ink-3">{rows.length ? "No projects match." : "No projects yet."}</li>
        ) : null}
      </ul>
    </div>
  );
}
