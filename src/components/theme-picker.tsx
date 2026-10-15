"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { chooseTheme, PRESET_IDS, THEMES, type Palette } from "@/lib/theme";
import { ThemeSwatch } from "./theme-swatch";
import { Check, Swatch } from "./ui/icons";
import { useReapplyTheme, useThemes } from "./use-theme";

/** The header's theme button: every preset and saved theme one click away, and a way to make more. */
export function ThemePicker() {
  useReapplyTheme();
  const { chosenId, custom } = useThemes();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [seen, setSeen] = useState(path);
  const box = useRef<HTMLDivElement>(null);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const option = (id: string, name: string, palette: Palette) => (
    <button
      key={id}
      type="button"
      role="menuitemradio"
      aria-checked={chosenId === id}
      onClick={() => chooseTheme(id, palette)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-ink-2 hover:bg-surface-2 hover:text-ink aria-checked:text-ink"
    >
      <ThemeSwatch palette={palette} className="h-6 w-9" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {chosenId === id ? <Check size={14} className="text-accent" /> : null}
    </button>
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Theme"
        title="Theme"
        className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Swatch size={16} />
      </button>
      {open ? (
        <div role="menu" aria-label="Theme" className="panel absolute top-10 right-0 z-40 w-64 p-1.5 text-sm">
          <div className="grid max-h-[min(70vh,28rem)] gap-0.5 overflow-y-auto">
            {PRESET_IDS.map((id) => option(`preset:${id}`, THEMES[id].name, THEMES[id].palette))}
            {custom.length ? <div className="mx-2 my-1 border-t border-line" role="separator" /> : null}
            {custom.map((t) => option(`custom:${t.name}`, t.name, t.palette))}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <Link href="/theme" className="block rounded-lg px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
              Make your own…
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
