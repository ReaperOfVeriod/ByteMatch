"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { COMPARE_COLORS } from "@/lib/chart-colors";

export interface CompareSeries {
  /** Stable id (owner/repo), so a project keeps its colour. */
  id: string;
  label: string;
  /** [time in ms, code matched %], oldest first. */
  points: [number, number][];
}

const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** The value in effect at time T (progress changes at commits, so it is a step function). */
function at(points: [number, number][], t: number): number | null {
  let v: number | null = null;
  for (const [pt, pv] of points) {
    if (pt > t) break;
    v = pv;
  }
  return v;
}

/** Several projects' code matched over time on one 0–100% axis, with a legend and a crosshair tooltip. */
export function CompareChart({ series }: { series: CompareSeries[] }) {
  const shown = useMemo(() => series.filter((s) => s.points.length).slice(0, COMPARE_COLORS.length), [series]);
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const W = useWidth(wrap) || 720;
  const compact = W < 520;
  const H = compact ? 200 : 260;
  const PAD = { top: 12, right: compact ? 10 : 64, bottom: 28, left: 40 };

  if (shown.length === 0) return <p className="text-sm text-ink-3">No history yet.</p>;

  const t0 = Math.min(...shown.map((s) => s.points[0][0]));
  const t1 = Math.max(t0 + 1, ...shown.map((s) => s.points[s.points.length - 1][0]));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;
  const path = (pts: [number, number][]) => pts.map(([t, v], i) => (i ? `H${x(t)}V${y(v)}` : `M${x(t)},${y(v)}`)).join("") + `H${x(t1)}`;
  const tickCount = compact ? 3 : 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) => t0 + ((t1 - t0) * i) / (tickCount - 1));

  // End labels, pushed apart where lines finish close together.
  const labelY = shown
    .map((s, i) => ({ s, i, ly: y(s.points[s.points.length - 1][1]) }))
    .sort((a, b) => a.ly - b.ly)
    .map((l, k, all) => {
      if (k > 0 && l.ly - all[k - 1].ly < 13) l.ly = all[k - 1].ly + 13;
      return l;
    });

  const onMove = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(t0, Math.min(t1, t0 + ((px - PAD.left) / plotW) * (t1 - t0))));
  };
  const rows =
    hover === null
      ? []
      : shown
          .map((s, i) => ({ s, color: COMPARE_COLORS[i], v: at(s.points, hover) }))
          .filter((r) => r.v !== null)
          .sort((a, b) => b.v! - a.v!);

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
        {shown.map((s, i) => (
          <li key={s.id} className="flex min-w-0 items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 shrink-0 rounded" style={{ background: COMPARE_COLORS[i] }} />
            <span className="truncate">{s.label}</span>
          </li>
        ))}
        {series.length > shown.length ? <li className="text-ink-3">{series.length - shown.length} more not drawn</li> : null}
      </ul>
      <div className="relative" ref={wrap}>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`Code matched over time: ${shown.map((s) => `${s.label} ${s.points[s.points.length - 1][1].toFixed(2)}%`).join(", ")}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
                {v}%
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={x(t)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === tickCount - 1 ? "end" : "middle"}
              fontSize={11}
              fill="var(--text-3)"
            >
              {fmtMonth.format(t)}
            </text>
          ))}
          {shown.map((s, i) => (
            <path
              key={s.id}
              d={path(s.points)}
              fill="none"
              stroke={COMPARE_COLORS[i]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {!compact &&
            labelY.map(({ s, i, ly }) => (
              <text key={s.id} x={x(t1) + 8} y={ly} dy="0.32em" fontSize={11} fill="var(--text-2)">
                <title>{s.label}</title>
                {s.points[s.points.length - 1][1].toFixed(1)}%<tspan fill={COMPARE_COLORS[i]}> ●</tspan>
              </text>
            ))}
          {hover !== null ? (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--text-3)" strokeDasharray="3 3" />
              {rows.map((r) => (
                <circle key={r.s.id} cx={x(hover)} cy={y(r.v!)} r={4} fill={r.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          ) : null}
        </svg>
        {hover !== null && rows.length ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-64 rounded-xl border border-line-strong bg-surface-2 p-3 text-xs shadow-[0_8px_24px_-8px_rgb(0_0_0/0.7)]"
            style={x(hover) > W / 2 ? { left: `${(PAD.left / W) * 100}%` } : { right: `${(PAD.right / W) * 100}%` }}
          >
            <div className="text-ink-3">{fmtDate.format(hover)}</div>
            <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
              {rows.map((r) => (
                <div key={r.s.id} className="contents">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: r.color }} />
                  <span className="truncate text-ink-2">{r.s.label}</span>
                  <span className="font-mono">{r.v!.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
