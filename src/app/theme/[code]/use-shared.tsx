"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "@/components/ui/icons";
import { useTheme } from "@/components/use-theme";
import { serializeTheme, type Theme } from "@/lib/theme";

/** Adds a shared theme to this browser's themes and switches to it, saying exactly what happened. */
export function UseSharedTheme({ theme }: { theme: Theme }) {
  const { custom, saveCustom, choose, chosen, preview, endPreview } = useTheme();
  const [done, setDone] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  // Trying it repaints the whole page; leaving the page (or stopping) puts your own theme back.
  useEffect(() => {
    if (trying) preview(theme.palette, theme.style);
    else endPreview();
  }, [trying, theme, preview, endPreview]);
  useEffect(() => () => endPreview(), [endPreview]);
  const have = custom.find((t) => t.code === theme.code || serializeTheme(t) === serializeTheme(theme));
  const inUse = have && chosen.colours === `custom:${have.name}`;

  function use() {
    setTrying(false);
    if (have) {
      choose({ colours: `custom:${have.name}`, palette: have.palette, style: have.style });
      return setDone(`Switched to “${have.name}”, which you already had.`);
    }
    const taken = new Set(custom.map((t) => t.name));
    let name = theme.name;
    for (let i = 2; taken.has(name); i++) name = `${theme.name} ${i}`;
    const saved: Theme = name === theme.name ? theme : { name, palette: theme.palette, style: theme.style };
    saveCustom([...custom, saved]);
    choose({ colours: `custom:${name}`, palette: saved.palette, style: saved.style });
    setDone(
      name === theme.name
        ? `Added “${name}” to your themes. It's in use now.`
        : `Added as “${name}” (you already had a “${theme.name}”). It's in use now.`,
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {inUse && !done ? (
        <p className="flex items-center gap-2 text-sm text-good">
          <Check size={14} /> You&apos;re using this theme.
        </p>
      ) : (
        <button type="button" className="btn btn-primary" onClick={use} disabled={!!done}>
          {have ? "Use this theme" : "Add to my themes and use it"}
        </button>
      )}
      {!done && !inUse ? (
        <button type="button" className="btn btn-ghost" aria-pressed={trying} onClick={() => setTrying((t) => !t)}>
          {trying ? "Stop trying it" : "Try it on this page"}
        </button>
      ) : null}
      {done ? (
        <p role="status" className="flex items-center gap-2 text-sm text-good">
          <Check size={14} /> {done}
        </p>
      ) : null}
      <Link href="/theme" className="btn btn-ghost">
        {done || inUse ? "See your themes" : "Back to themes"}
      </Link>
    </div>
  );
}
