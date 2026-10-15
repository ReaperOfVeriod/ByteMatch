import Link from "next/link";
import { listQuery, pageWindow, type ListParams } from "@/lib/project-query";
import { ChevronRight } from "./ui/icons";

/** Previous / numbered / next links; plain links, so they work without JavaScript and for crawlers. */
export function Pagination({ params, pages, path = "/" }: { params: ListParams; pages: number; path?: string }) {
  if (pages <= 1) return null;
  const href = (page: number) => `${path}${listQuery({ ...params, page })}`;
  const current = params.page;
  const item = "grid h-9 min-w-9 place-items-center rounded-lg px-2.5 text-sm transition-colors";
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-1">
      {current > 1 ? (
        <Link
          href={href(current - 1)}
          rel="prev"
          className={`${item} text-ink-2 hover:bg-surface-2 hover:text-ink`}
          aria-label="Previous page"
        >
          <ChevronRight size={14} className="rotate-180" />
        </Link>
      ) : (
        <span className={`${item} text-ink-3 opacity-40`} aria-hidden>
          <ChevronRight size={14} className="rotate-180" />
        </span>
      )}
      {pageWindow(current, pages).map((n, i) =>
        n === null ? (
          <span key={`gap${i}`} className={`${item} text-ink-3`} aria-hidden>
            …
          </span>
        ) : n === current ? (
          <span key={n} aria-current="page" className={`${item} border border-line bg-surface-2 font-medium text-ink`}>
            {n}
          </span>
        ) : (
          <Link key={n} href={href(n)} className={`${item} text-ink-2 hover:bg-surface-2 hover:text-ink`}>
            {n}
          </Link>
        ),
      )}
      {current < pages ? (
        <Link href={href(current + 1)} rel="next" className={`${item} text-ink-2 hover:bg-surface-2 hover:text-ink`} aria-label="Next page">
          <ChevronRight size={14} />
        </Link>
      ) : (
        <span className={`${item} text-ink-3 opacity-40`} aria-hidden>
          <ChevronRight size={14} />
        </span>
      )}
    </nav>
  );
}
