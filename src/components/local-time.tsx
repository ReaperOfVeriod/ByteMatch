"use client";

import { useSyncExternalStore } from "react";

/**
 * A moment in the visitor's own time zone. The server doesn't know it, so the server render (and
 * the first client render, to match) shows UTC and says so; the browser then swaps in local time.
 *
 * - datetime: "Oct 14, 3:42 PM" (the year is added when it isn't this year)
 * - date: "Oct 14, 2026"
 * - ago: "just now", "5m ago", "3h ago", "4d ago", then the date
 *
 * Hovering shows the full date and time with the zone.
 */
export function LocalTime({
  value,
  style = "datetime",
  className,
}: {
  value: Date | string | number;
  style?: "datetime" | "date" | "ago";
  className?: string;
}) {
  const local = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const timeZone = local ? undefined : "UTC";
  const thisYear = new Date().getFullYear() === d.getFullYear();
  const date = (withYear: boolean) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone });

  let text: string;
  if (style === "date") text = date(true);
  else if (style === "ago") text = ago(d) ?? date(!thisYear);
  else
    text = `${date(!thisYear)}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}${local ? "" : " UTC"}`;

  return (
    <time
      dateTime={d.toISOString()}
      title={d.toLocaleString("en-US", { dateStyle: "full", timeStyle: "long", timeZone })}
      className={className}
      // "ago" depends on the clock, which moves between the server render and hydration.
      suppressHydrationWarning
    >
      {text}
    </time>
  );
}

const noop = () => () => {};

/** "just now", "5m ago", "3h ago" or "4d ago" within a week; null beyond. */
function ago(d: Date): string | null {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 0) return null;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return null;
}
