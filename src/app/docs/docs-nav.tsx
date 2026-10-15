"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DocsNav({ docs }: { docs: { slug: string; title: string; group: string }[] }) {
  const path = usePathname();
  const groups = [...new Set(docs.map((d) => d.group))];
  return (
    <nav aria-label="Documentation" className="grid gap-6 text-sm">
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
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
