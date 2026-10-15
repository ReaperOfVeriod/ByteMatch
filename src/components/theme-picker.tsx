"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRESET_IDS, STYLE_IDS, STYLES, styleId, THEMES, type Palette } from "@/lib/theme";
import { StyleSwatch, ThemeSwatch } from "./theme-swatch";
import { Check, Swatch } from "./ui/icons";
import { useTheme } from "./use-theme";

/** The header's theme button: colours and layouts one click away, and a way to make your own. */
export function ThemePicker() {
  const { chosen, choose, custom } = useTheme();
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

  const row =
    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-ink-2 hover:bg-surface-2 hover:text-ink aria-checked:text-ink";
  const colour = (id: string, name: string, palette: Palette, onPick: () => void) => (
    <button key={id} type="button" role="menuitemradio" aria-checked={chosen.colours === id} onClick={onPick} className={row}>
      <ThemeSwatch palette={palette} className="h-6 w-9" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {chosen.colours === id ? <Check size={14} className="text-accent" /> : null}
    </button>
  );
  const current = styleId(chosen.style);
  const heading = "px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase";

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
        <div role="menu" aria-label="Theme" className="panel absolute top-10 right-0 z-40 w-[min(34rem,calc(100vw-2rem))] p-1.5 text-sm">
          <div className="grid max-h-[min(70vh,30rem)] gap-1 overflow-y-auto sm:grid-cols-2">
            <div role="group" aria-label="Colours">
              <div className={heading}>Colours</div>
              {PRESET_IDS.map((id) =>
                colour(`preset:${id}`, THEMES[id].name, THEMES[id].palette, () =>
                  choose({ colours: `preset:${id}`, palette: THEMES[id].palette }),
                ),
              )}
              {custom.length ? (
                <>
                  <div className={heading}>Yours</div>
                  {custom.map((t) =>
                    colour(`custom:${t.name}`, t.name, t.palette, () =>
                      choose({ colours: `custom:${t.name}`, palette: t.palette, style: t.style }),
                    ),
                  )}
                </>
              ) : null}
            </div>
            <div role="group" aria-label="Layout">
              <div className={heading}>Layout</div>
              {STYLE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current === id}
                  onClick={() => choose({ style: STYLES[id].style })}
                  className={row}
                >
                  <StyleSwatch style={STYLES[id].style} className="h-6 w-9" />
                  <span className="min-w-0 flex-1 truncate">{STYLES[id].name}</span>
                  {current === id ? <Check size={14} className="text-accent" /> : null}
                </button>
              ))}
              {current === null ? <div className="px-2 py-1.5 text-xs text-ink-3">Your own mix is in use.</div> : null}
            </div>
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <Link href="/theme" className="block rounded-lg px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
              Make, import or share themes…
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
