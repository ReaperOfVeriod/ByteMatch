"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "@/components/ui/icons";

export function DocsNav({ docs }: { docs: { slug: string; title: string; group: string; headings: { id: string; text: string }[] }[] }) {
  const path = usePathname();
  const groups = [...new Set(docs.map((d) => d.group))];
  // Small screens: one "Contents" button naming the current page; the list opens on demand.
  const [open, setOpen] = useState(false);
  const current = docs.find((d) => path === `/docs/${d.slug}`)?.title ?? "Overview";
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setOpen(false);
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="docs-nav"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm lg:hidden"
      >
        <span className="text-ink-3">Contents</span>
        <span className="truncate font-medium text-ink">{current}</span>
        <ChevronDown size={14} className={`ml-auto shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <nav
        id="docs-nav"
        aria-label="Documentation"
        className={`${open ? "grid" : "hidden"} mt-3 gap-6 border-t border-line pt-4 text-sm lg:mt-0 lg:grid lg:border-0 lg:pt-0`}
      >
        <Link
          href="/docs"
          aria-current={path === "/docs" ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 ${path === "/docs" ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
        >
          Overview
        </Link>
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1.5 px-3 text-xs font-medium text-ink-3">{g}</div>
            <ul className="grid gap-0.5">
              {docs
                .filter((d) => d.group === g)
                .map((d) => {
                  const href = `/docs/${d.slug}`;
                  const active = path === href;
                  return (
                    <li key={d.slug}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-lg px-3 py-1.5 transition-colors ${active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"}`}
                      >
                        {d.title}
                      </Link>
                      {active && d.headings.length > 1 ? (
                        <ul className="mt-1 mb-2 ml-3 grid gap-0.5 border-l border-line pl-2">
                          {d.headings.map((h) => (
                            <li key={h.id}>
                              <a
                                href={`#${h.id}`}
                                className="block truncate rounded-md px-2 py-1 text-[13px] text-ink-3 hover:bg-surface-2/60 hover:text-ink"
                              >
                                {h.text}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
