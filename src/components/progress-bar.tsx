/** One magnitude on a 0–100 track; the number is always printed beside it, so the bar is never read alone. */
export function ProgressBar({ value, label, tone = "series-1" }: { value: number; label: string; tone?: "series-1" | "series-2" }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-track"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(v.toFixed(2))}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${tone === "series-1" ? "bg-series-1" : "bg-series-2"}`} style={{ width: `${v}%` }} />
    </div>
  );
}
