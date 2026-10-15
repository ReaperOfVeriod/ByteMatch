"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Close } from "./ui/icons";

export interface MenuLink {
  href: string;
  label: string;
  external?: boolean;
}

/** Small screens: every header link behind one button; closes on navigation, outside taps and Escape. */
export function MobileMenu({ links, signOut, user }: { links: MenuLink[]; signOut: boolean; user: string | null }) {
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

  return (
    <div ref={box} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2"
      >
        {open ? (
          <Close size={16} />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        )}
      </button>
      {open ? (
        <div id="mobile-menu" className="panel absolute top-11 right-0 z-40 grid w-60 gap-0.5 p-2 text-sm">
          {user ? <div className="truncate px-3 pt-1 pb-2 text-xs text-ink-3">Signed in as {user}</div> : null}
          {links.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                aria-current={path === l.href ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink aria-[current=page]:text-ink"
              >
                {l.label}
              </Link>
            ),
          )}
          {signOut ? (
            <form action="/auth/logout" method="post" className="mt-1 border-t border-line pt-1">
              <button className="w-full rounded-lg px-3 py-2 text-left text-ink-2 hover:bg-surface-2 hover:text-ink">Sign out</button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
