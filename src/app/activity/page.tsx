import Link from "next/link";
import { ExternalImage } from "@/components/external-image";
import { milestones, movers, type Milestone } from "@/db/store";
import { gameRows } from "@/lib/game-data";
import { browseMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return browseMetadata(
    "Activity",
    "Milestones across tracked decompilation projects: who just passed 50%, 90% or a full match, and who gained the most this week.",
    "/activity",
  );
}

const fmt = new Intl.NumberFormat("en-US");
const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function Icon({ src, name, size = "size-9" }: { src: string | null; name: string; size?: string }) {
  const initial = (
    <div
      className={`grid ${size} shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-xs font-semibold text-ink-3`}
      aria-hidden
    >
      {name.slice(0, 1)}
    </div>
  );
  return src ? (
    <ExternalImage src={src} className={`${size} shrink-0 rounded-lg border border-line object-cover`} fallback={initial} />
  ) : (
    initial
  );
}

/** The threshold as a chip: a full match stands out, the rest are quiet. */
function Badge({ threshold }: { threshold: number }) {
  return threshold >= 100 ? (
    <span className="shrink-0 rounded-full bg-done/15 px-2 py-0.5 font-mono text-xs font-semibold text-good">100%</span>
  ) : (
    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-ink">{threshold}%</span>
  );
}

function groupByMonth(list: Milestone[]) {
  const months = new Map<string, Milestone[]>();
  for (const m of list) {
    const key = fmtMonth.format(m.reached);
    months.set(key, [...(months.get(key) ?? []), m]);
  }
  return [...months];
}

export default async function Activity() {
  const [list, week, rows] = await Promise.all([milestones(60), movers(7), gameRows()]);
  const added = rows
    .filter((r) => r.createdAt)
    .sort((a, b) => b.createdAt!.localeCompare(a.createdAt!))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Milestones from every tracked project&apos;s history: the commit where its code matched first passed 10, 25, 50, 75, 90, 95, 99 or
          100%.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="panel overflow-hidden lg:order-1" aria-labelledby="milestones">
          <h2 id="milestones" className="sr-only">
            Milestones
          </h2>
          {list.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">No milestones yet.</p>
          ) : (
            groupByMonth(list).map(([month, items]) => (
              <div key={month}>
                <h3 className="border-b border-line bg-surface-2/60 px-5 py-2 text-xs font-medium text-ink-3">{month}</h3>
                <ul className="divide-y divide-line">
                  {items.map((m) => (
                    <li key={`${m.owner}/${m.repo}@${m.commit_sha}`} className="flex items-start gap-3.5 px-5 py-3.5">
                      <Icon src={m.icon_url} name={m.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <Link href={`/${m.owner}/${m.repo}`} className="font-medium hover:underline">
                            {m.name}
                          </Link>
                          <span className="text-ink-2">{m.threshold >= 100 ? "fully matched its code" : "passed"}</span>
                          <Badge threshold={m.threshold} />
                          <span className="font-mono text-xs text-ink-3">{m.version}</span>
                        </div>
                        <a
                          href={`https://github.com/${m.owner}/${m.repo}/commit/${m.commit_sha}`}
                          className="mt-0.5 block truncate text-xs text-ink-3 hover:text-ink"
                          title={m.commit_message ?? undefined}
                        >
                          <span className="font-mono">{m.commit_sha.slice(0, 7)}</span>
                          {m.commit_message ? ` · ${m.commit_message.split("\n")[0]}` : ""}
                        </a>
                      </div>
                      <time dateTime={m.reached.toISOString()} className="shrink-0 text-xs text-ink-3">
                        {fmtDay.format(m.reached)}
                      </time>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:sticky lg:top-20 lg:order-2" aria-label="This week">
          <section className="panel p-5">
            <h2 className="mb-3.5 flex items-baseline gap-2 text-sm font-semibold">
              Biggest gains <span className="text-xs font-normal text-ink-3">last 7 days</span>
            </h2>
            {week.length === 0 ? (
              <p className="text-sm text-ink-3">Quiet week.</p>
            ) : (
              <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {week.map((w) => (
                  <li key={`${w.owner}/${w.repo}`} className="flex items-center gap-3">
                    <Icon src={w.icon_url} name={w.name} size="size-8" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/${w.owner}/${w.repo}`} className="block truncate text-sm font-medium hover:underline">
                        {w.name}
                      </Link>
                      <div className="text-xs text-ink-3">
                        {w.functions_gained > 0 ? `${fmt.format(w.functions_gained)} functions · ` : ""}
                        {w.commits} commit{w.commits === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm text-good">+{w.gain.toFixed(2)}</div>
                      <div className="font-mono text-xs text-ink-3">{w.pct.toFixed(1)}%</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {added.length ? (
            <section className="panel p-5">
              <h2 className="mb-3.5 text-sm font-semibold">New here</h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {added.map((r) => (
                  <li key={`${r.owner}/${r.repo}`} className="flex items-center gap-3">
                    <Icon src={r.image} name={r.name} size="size-8" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/${r.owner}/${r.repo}`} className="block truncate text-sm font-medium hover:underline">
                        {r.name}
                      </Link>
                      <div className="truncate text-xs text-ink-3">
                        {r.game ?? `${r.owner}/${r.repo}`}
                        {r.platformName ? ` · ${r.platformName}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-ink-3">{fmtDay.format(new Date(r.createdAt!))}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
