import Link from "next/link";
import { currentSession } from "@/auth/session";
import { LocalTime } from "@/components/local-time";
import { ThemeSwatch } from "@/components/theme-swatch";
import { listSharedThemes, SHARES_PER_HOUR, UNUSED_DAYS } from "@/db/themes";
import { getSettings } from "@/lib/settings";
import type { Palette } from "@/lib/theme";
import { removeSharerAction, setThemeRemovedAction, setThemeSharingAction } from "../actions";
import { ActionButton, ConfirmButton, ThemeSharingForm } from "../ui";

/** Shared theme codes: how many, the limits on them, and removing ones that shouldn't be there. */
export default async function AdminThemes() {
  const session = await currentSession();
  const [{ rows, stats }, settings] = await Promise.all([listSharedThemes(100), getSettings()]);
  const near = stats.today >= settings.themeDailyLimit * 0.8;
  return (
    <div className="grid gap-4">
      <section className="panel grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold">Sharing</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-3">Live codes</dt>
              <dd className="font-mono text-xl">{stats.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">New in 24 hours</dt>
              <dd className={`font-mono text-xl ${near ? "text-warn" : ""}`}>
                {stats.today}
                <span className="text-sm text-ink-3"> / {settings.themeDailyLimit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Removed</dt>
              <dd className="font-mono text-xl">{stats.removed}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-ink-2">
            Sharing is{" "}
            <strong className={settings.themeSharingPaused ? "text-bad" : "text-good"}>
              {settings.themeSharingPaused ? "paused" : "open"}
            </strong>
            . Each address may create {SHARES_PER_HOUR} new codes an hour; codes nobody uses for {UNUSED_DAYS} days are deleted. Removed
            themes stop working and can&apos;t be shared again.
          </p>
        </div>
        {session?.owner ? (
          <ThemeSharingForm action={setThemeSharingAction} paused={settings.themeSharingPaused} dailyLimit={settings.themeDailyLimit} />
        ) : (
          <p className="text-sm text-ink-3">Only owners can pause sharing or change the daily limit.</p>
        )}
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Newest shared themes</h2>
        <ul className="divide-y divide-line">
          {rows.map((t) => (
            <li
              key={t.code}
              className={`grid gap-3 px-5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${t.removedAt ? "opacity-60" : ""}`}
            >
              <ThemeSwatch palette={t.palette as unknown as Palette} className="h-9 w-14" />
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate font-medium">{t.name}</span>
                  {t.removedAt ? (
                    <span className="text-xs text-bad">removed</span>
                  ) : (
                    <Link href={`/theme/${t.code}`} className="font-mono text-xs text-accent hover:underline">
                      {t.code}
                    </Link>
                  )}
                </div>
                <div className="text-xs text-ink-3">
                  Shared <LocalTime value={t.createdAt} /> · last used <LocalTime value={t.lastUsedAt} /> · sharer{" "}
                  <span className="font-mono">{t.sharerHash?.slice(0, 8) ?? "?"}</span>
                  {t.bySharer > 1 ? <span className={t.bySharer >= 10 ? "text-warn" : ""}> ({t.bySharer} themes)</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.removedAt ? (
                  <ActionButton action={setThemeRemovedAction} fields={{ code: t.code, removed: "false" }} label="Restore" />
                ) : (
                  <ConfirmButton
                    action={setThemeRemovedAction}
                    fields={{ code: t.code, removed: "true" }}
                    label="Remove"
                    confirm="Remove"
                  />
                )}
                {t.sharerHash && t.bySharer > 1 ? (
                  <ConfirmButton
                    action={removeSharerAction}
                    fields={{ sharer: t.sharerHash }}
                    label={`Remove all ${t.bySharer} from this sharer`}
                    confirm={`Remove ${t.bySharer}`}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-5 py-8 text-center text-sm text-ink-3">No themes shared yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
