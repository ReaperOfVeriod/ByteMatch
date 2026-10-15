"use client";

import { useMemo, useRef, useState } from "react";
import { squarify } from "./treemap";
import { parseUnitFilter } from "./unit-filter";

export interface MapUnit {
  name: string;
  totalCode: number;
  matchedCodePercent: number;
  fuzzy: number;
  matchedFunctions: number;
  totalFunctions: number;
  categories: string[];
}

interface FunctionRow {
  name: string;
  size: number;
  fuzzy_match_percent: number;
  address: number | null;
}

const W = 1000;
const H = 560;
const fmt = new Intl.NumberFormat("en-US");

const GREEN = "#2f9e44";
const BLUE = "#2563b8";
const GREY = "#3a3a37";

/**
 * A tile fills with green from the bottom by its matched share; the rest is blue where work has
 * started (fuzzy match above what is matched) and grey where nothing has.
 */
function tileBackground(u: MapUnit): string {
  const matched = Math.max(0, Math.min(100, u.matchedCodePercent));
  if (matched >= 100) return GREEN;
  const rest = u.fuzzy > matched + 0.01 ? BLUE : GREY;
  return matched <= 0 ? rest : `linear-gradient(to top, ${GREEN} ${matched}%, ${rest} ${matched}%)`;
}

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

export function UnitMap({
  units,
  categories,
  owner,
  repo,
  version,
}: {
  units: MapUnit[];
  categories: { id: string; name: string }[];
  owner: string;
  repo: string;
  version: string;
}) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<{ unit: MapUnit; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<MapUnit | null>(null);
  const [functions, setFunctions] = useState<FunctionRow[] | "loading" | "error" | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const usedCategories = useMemo(() => categories.filter((c) => units.some((u) => u.categories.includes(c.id))), [categories, units]);
  const shown = useMemo(() => {
    const test = parseUnitFilter(query);
    return units.filter((u) => (!category || u.categories.includes(category)) && test(u));
  }, [units, category, query]);
  const rects = useMemo(() => squarify(shown, (u) => u.totalCode, W, H), [shown]);
  const shownBytes = shown.reduce((n, u) => n + u.totalCode, 0);

  const request = useRef(0);
  const select = (u: MapUnit) => {
    const id = ++request.current;
    setSelected(u);
    setFunctions("loading");
    fetch(`/api/v1/projects/${owner}/${repo}/units?version=${encodeURIComponent(version)}&unit=${encodeURIComponent(u.name)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (d: { functions: FunctionRow[] }) =>
          id === request.current && setFunctions(d.functions.sort((a, b) => (a.address ?? 0) - (b.address ?? 0))),
      )
      .catch(() => id === request.current && setFunctions("error"));
    requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[14rem_1fr]">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm"
        >
          <option value="">All</option>
          {usedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.id}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter, e.g. camera <70% >10kb"
          aria-label="Filter units"
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm"
        />
      </div>

      <div
        className="relative w-full overflow-hidden rounded-md bg-surface"
        style={{ aspectRatio: `${W} / ${H}` }}
        onMouseLeave={() => setHover(null)}
      >
        {rects.map(({ item: u, x, y, w, h }) => (
          <button
            key={u.name}
            onClick={() => select(u)}
            onMouseMove={(e) => {
              const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              setHover({ unit: u, x: e.clientX - box.left, y: e.clientY - box.top });
            }}
            aria-label={`${u.name}, ${u.matchedCodePercent.toFixed(1)}% matched`}
            className="absolute hover:brightness-125 focus-visible:z-10"
            style={{
              left: `${(x / W) * 100}%`,
              top: `${(y / H) * 100}%`,
              width: `${(w / W) * 100}%`,
              height: `${(h / H) * 100}%`,
              background: tileBackground(u),
              boxShadow: selected?.name === u.name ? "inset 0 0 0 2px #f0efec" : "inset 0 0 0 0.5px rgb(0 0 0 / 0.55)",
            }}
          />
        ))}
        {rects.length === 0 ? <p className="p-6 text-sm text-ink-3">No units match.</p> : null}
        {hover ? (
          <div
            className="pointer-events-none absolute z-20 max-w-72 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: hover.x + 12, top: hover.y + 12, transform: hover.x > 640 ? "translateX(calc(-100% - 24px))" : undefined }}
          >
            <div className="truncate font-mono">{hover.unit.name}</div>
            <div className="text-ink-2">
              {hover.unit.matchedCodePercent.toFixed(1)}% · {size(hover.unit.totalCode)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <Swatch color={GREEN} label="Matched" />
        <Swatch color={BLUE} label="Partly matched" />
        <Swatch color={GREY} label="Not started" />
        <span className="ml-auto">
          {fmt.format(shown.length)} units · {size(shownBytes)}
        </span>
      </div>

      <div ref={panel}>
        {selected ? (
          <div className="mt-4 rounded-md border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm">{selected.name}</div>
                <div className="mt-0.5 text-xs text-ink-2">
                  {selected.matchedCodePercent.toFixed(2)}% matched · {fmt.format(selected.matchedFunctions)} /{" "}
                  {fmt.format(selected.totalFunctions)} functions · {size(selected.totalCode)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="ml-auto text-xs text-ink-3 hover:text-ink" aria-label="Close">
                Close
              </button>
            </div>
            {functions === "loading" ? <p className="mt-3 text-xs text-ink-3">Loading…</p> : null}
            {functions === "error" ? <p className="mt-3 text-xs text-bad">Could not load functions.</p> : null}
            {Array.isArray(functions) ? (
              <ul className="mt-3 grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
                {functions.map((f) => (
                  <li key={`${f.name}@${f.address}`} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: f.fuzzy_match_percent >= 100 ? GREEN : f.fuzzy_match_percent > 0 ? BLUE : GREY }}
                    />
                    <span className="truncate font-mono">{f.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-ink-3 tabular-nums">
                      {f.fuzzy_match_percent >= 100 ? "" : `${f.fuzzy_match_percent.toFixed(0)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
