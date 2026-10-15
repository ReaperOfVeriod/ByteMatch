"use client";

import { useMemo, useRef, useState } from "react";

export interface HistoryPoint {
  /** Commit time, ms since epoch. */
  t: number;
  code: number;
  functions: number;
  sha: string;
  message: string | null;
  matchedFunctions: number;
  totalFunctions: number;
}

const RANGES = [
  { id: "all", label: "All", days: Infinity },
  { id: "1y", label: "1 year", days: 365 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "30d", label: "30 days", days: 30 },
] as const;

const SERIES = [
  { key: "code", label: "Code matched", color: "var(--series-1)" },
  { key: "functions", label: "Functions matched", color: "var(--series-2)" },
] as const;

const W = 760;
const H = 260;
const PAD = { top: 12, right: 112, bottom: 28, left: 40 };
const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
/** Axis dates: days for spans under ~5 months, months beyond that. */
const axisLabel = (t: number, span: number) => (span < 150 * 86400_000 ? fmtDay : fmtMonth).format(t);
const fmtInt = new Intl.NumberFormat("en-US");

/**
 * Progress over time: two percentages on one 0–100% axis (same unit, so one axis is honest),
 * step lines because progress changes at commits, legend plus end labels, crosshair tooltip.
 */
export function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("all");
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    if (!Number.isFinite(days) || points.length === 0) return points;
    const from = points[points.length - 1].t - days * 86400_000;
    // Keep the last point before the window so the line starts at the window's left edge.
    const firstIn = points.findIndex((p) => p.t >= from);
    return firstIn <= 0 ? points : points.slice(firstIn - 1);
  }, [points, range]);

  if (points.length === 0) return <p className="text-sm text-ink-3">No history yet.</p>;

  const t0 = data[0].t;
  const t1 = Math.max(data[data.length - 1].t, t0 + 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;

  const path = (key: "code" | "functions") =>
    data.map((p, i) => (i === 0 ? `M${x(p.t)},${y(p[key])}` : `H${x(p.t)}V${y(p[key])}`)).join("") + `H${x(t1)}`;

  const ticks = [0, 25, 50, 75, 100];
  const xTicks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  const last = data[data.length - 1];
  // End labels, nudged apart when the two lines finish close together.
  let ly = [y(last.code), y(last.functions)];
  if (Math.abs(ly[0] - ly[1]) < 14) {
    const mid = (ly[0] + ly[1]) / 2;
    ly = last.code >= last.functions ? [mid - 7, mid + 7] : [mid + 7, mid - 7];
  }

  const onMove = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = t0 + ((px - PAD.left) / plotW) * (t1 - t0);
    // The commit in effect at time t (step semantics).
    let i = data.findIndex((p) => p.t > t) - 1;
    if (i < 0) i = t < t0 ? 0 : data.length - 1;
    setHover(i);
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ul className="flex gap-4 text-xs text-ink-2" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="ml-auto flex rounded-md border border-line p-0.5 text-xs" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={`rounded px-2 py-1 ${range === r.id ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`Progress history: code matched ${last.code.toFixed(2)}%, functions matched ${last.functions.toFixed(2)}%`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
                {v}%
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} fontSize={11} fill="var(--text-3)">
              {axisLabel(t, t1 - t0)}
            </text>
          ))}
          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {SERIES.map((s, i) => (
            <text key={s.key} x={x(t1) + 8} y={ly[i]} dy="0.32em" fontSize={11} fill="var(--text-2)">
              {(s.key === "code" ? last.code : last.functions).toFixed(2)}% {s.key === "code" ? "code" : "functions"}
            </text>
          ))}
          {h ? (
            <g pointerEvents="none">
              <line
                x1={x(h.t)}
                x2={x(h.t)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--text-3)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(h.t)} cy={y(h[s.key])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          ) : null}
        </svg>
        {h ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-64 rounded-md border border-line bg-surface p-2.5 text-xs shadow-md"
            style={x(h.t) > W / 2 ? { left: `${(PAD.left / W) * 100}%` } : { right: `${(PAD.right / W) * 100}%` }}
          >
            <div className="text-ink-3">{fmtDate.format(h.t)}</div>
            <div className="mt-0.5 truncate font-medium">{h.message?.split("\n")[0] ?? h.sha.slice(0, 7)}</div>
            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: "var(--series-1)" }} />
              <span className="text-ink-2">Code matched</span>
              <span className="font-mono tabular-nums">{h.code.toFixed(2)}%</span>
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: "var(--series-2)" }} />
              <span className="text-ink-2">Functions</span>
              <span className="font-mono tabular-nums">
                {fmtInt.format(h.matchedFunctions)} / {fmtInt.format(h.totalFunctions)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
