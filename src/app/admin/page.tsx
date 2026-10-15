import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { Check as CheckIcon, Close } from "@/components/ui/icons";
import { health } from "@/lib/health";

const fmt = new Intl.NumberFormat("en-US");
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90
    ? `${s}s ago`
    : s < 5400
      ? `${Math.round(s / 60)} min ago`
      : s < 172800
        ? `${Math.round(s / 3600)} h ago`
        : `${Math.round(s / 86400)} days ago`;
};

function Card({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "good" | "bad" | "warn" }) {
  const dot = tone === "good" ? "bg-done" : tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-[#eda100]" : "bg-ink-3";
  return (
    <section className="panel p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {title}
      </h2>
      <div className="text-sm text-ink-2">{children}</div>
    </section>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckIcon size={14} className="text-good" /> : <Close size={14} className="text-bad" />}
      {label}
    </li>
  );
}

export default async function AdminOverview() {
  const [h, [counts]] = await Promise.all([
    health(),
    db().execute<{ projects: number; disabled: number; erroring: number; users: number; blocked: number }>(sql`
      select (select count(*) from projects)::int as projects,
             (select count(*) from projects where not enabled)::int as disabled,
             (select count(*) from projects where enabled and last_error is not null)::int as erroring,
             (select count(*) from users)::int as users,
             (select count(*) from blocked_accounts)::int as blocked`),
  ]);
  const byState = (state: string) => h.jobs.filter((j) => j.state === state).reduce((n, j) => n + j.count, 0);
  const waiting = byState("created") + byState("retry");
  const failed = byState("failed");

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card title="Worker" tone={h.worker.alive ? "good" : "bad"}>
        {h.worker.alive ? "Running." : "Not running: no heartbeat in the last 3 minutes. Check pm2 logs bytematch-worker."}
        <div className="mt-1 text-xs text-ink-3">Last heartbeat {ago(h.worker.lastBeat)}</div>
        {h.syncPaused ? (
          <div className="mt-2 text-xs text-bad">
            Syncing is paused.{" "}
            <Link href="/admin/settings" className="underline">
              Settings
            </Link>
          </div>
        ) : null}
      </Card>
      <Card title="Jobs" tone={failed ? "warn" : "good"}>
        <div className="grid grid-cols-3 gap-2 font-mono">
          <div>
            <div className="text-xl text-ink">{fmt.format(byState("active"))}</div>
            <div className="text-xs text-ink-3">running</div>
          </div>
          <div>
            <div className="text-xl text-ink">{fmt.format(waiting)}</div>
            <div className="text-xs text-ink-3">waiting</div>
          </div>
          <div>
            <div className={`text-xl ${failed ? "text-bad" : "text-ink"}`}>{fmt.format(failed)}</div>
            <div className="text-xs text-ink-3">failed</div>
          </div>
        </div>
        {failed ? (
          <Link href="/admin/jobs" className="mt-2 inline-block text-xs text-accent hover:underline">
            Review failed jobs
          </Link>
        ) : null}
      </Card>
      <Card
        title="GitHub token"
        tone={!h.githubToken.configured ? undefined : h.githubToken.error ? "bad" : (h.githubToken.remaining ?? 0) < 500 ? "warn" : "good"}
      >
        {!h.githubToken.configured ? (
          "Not set. Repositories without the GitHub App can't be read."
        ) : h.githubToken.error ? (
          h.githubToken.error
        ) : (
          <>
            {fmt.format(h.githubToken.remaining ?? 0)} of {fmt.format(h.githubToken.limit ?? 0)} requests left this hour
            <div className="mt-1 text-xs text-ink-3">
              Resets{" "}
              {h.githubToken.resetsAt
                ? new Date(h.githubToken.resetsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : "soon"}
            </div>
          </>
        )}
      </Card>
      <Card title="GitHub App" tone={h.app.configured && h.app.webhooks && h.app.signIn ? "good" : "warn"}>
        <ul className="grid gap-1">
          <Check ok={h.app.configured} label="App credentials" />
          <Check ok={h.app.webhooks} label="Webhook secret" />
          <Check ok={h.app.signIn} label="Sign-in (client id, secret, SECRET_KEY)" />
        </ul>
      </Card>
      <Card title="Projects" tone={counts.erroring ? "warn" : "good"}>
        <div className="grid grid-cols-3 gap-2 font-mono">
          <div>
            <div className="text-xl text-ink">{fmt.format(counts.projects)}</div>
            <div className="text-xs text-ink-3">total</div>
          </div>
          <div>
            <div className={`text-xl ${counts.erroring ? "text-[#f0b429]" : "text-ink"}`}>{fmt.format(counts.erroring)}</div>
            <div className="text-xs text-ink-3">erroring</div>
          </div>
          <div>
            <div className="text-xl text-ink">{fmt.format(counts.disabled)}</div>
            <div className="text-xs text-ink-3">disabled</div>
          </div>
        </div>
        <Link href="/admin/projects?status=erroring" className="mt-2 inline-block text-xs text-accent hover:underline">
          See erroring projects
        </Link>
      </Card>
      <Card title="Users">
        <div className="grid grid-cols-2 gap-2 font-mono">
          <div>
            <div className="text-xl text-ink">{fmt.format(counts.users)}</div>
            <div className="text-xs text-ink-3">signed in at least once</div>
          </div>
          <div>
            <div className="text-xl text-ink">{fmt.format(counts.blocked)}</div>
            <div className="text-xs text-ink-3">blocked</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
