import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { config } from "@/lib/config";
import { listBlocked } from "@/lib/moderation";
import { blockAccount, unblockAccount } from "../actions";
import { ActionButton, BlockForm } from "../ui";

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default async function AdminUsers() {
  const [users, blocked] = await Promise.all([
    db().execute<{
      id: number;
      login: string;
      name: string | null;
      avatar_url: string | null;
      created_at: string;
      last_seen: string | null;
      projects: number;
    }>(sql`
      select u.id, u.login, u.name, u.avatar_url, u.created_at,
             (select max(s.created_at) from sessions s where s.user_id = u.id) as last_seen,
             (select count(*) from projects p where p.created_by = u.id)::int as projects
      from users u order by u.created_at desc limit 500`),
    listBlocked(),
  ]);
  const admins = config().ADMIN_GITHUB_LOGINS;
  const isBlocked = (login: string) => blocked.some((b) => b.login.toLowerCase() === login.toLowerCase());

  return (
    <div className="grid gap-4">
      <section className="panel p-5">
        <h2 className="mb-1 text-sm font-semibold">Block an account</h2>
        <p className="mb-4 text-sm text-ink-2">
          Works before they ever sign in. Blocking signs them out and stops them signing in or submitting projects.
        </p>
        <BlockForm action={blockAccount} />
      </section>

      {blocked.length ? (
        <section className="panel overflow-hidden">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Blocked ({blocked.length})</h2>
          <ul className="divide-y divide-line">
            {blocked.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{b.login}</span>
                <span className="min-w-0 flex-1 truncate text-ink-3">{b.reason ?? "No reason given"}</span>
                <span className="text-xs text-ink-3">{fmtDate.format(b.createdAt)}</span>
                <ActionButton action={unblockAccount} fields={{ id: String(b.id) }} label="Unblock" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel overflow-hidden">
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Accounts ({[...users].length})</h2>
        <ul className="divide-y divide-line">
          {[...users].map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- GitHub avatar
                <img src={`${u.avatar_url}&s=48`} alt="" width={24} height={24} className="rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="size-6 rounded-full bg-surface-3" aria-hidden />
              )}
              <a href={`https://github.com/${u.login}`} className="font-medium hover:underline">
                {u.login}
              </a>
              {admins.includes(u.login.toLowerCase()) ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">admin</span>
              ) : null}
              {isBlocked(u.login) ? <span className="rounded-full bg-bad/15 px-2 py-0.5 text-[11px] text-bad">blocked</span> : null}
              <span className="ml-auto text-xs text-ink-3">
                {u.projects} project{u.projects === 1 ? "" : "s"} · joined {fmtDate.format(new Date(u.created_at))}
                {u.last_seen ? ` · last signed in ${fmtDate.format(new Date(u.last_seen))}` : ""}
              </span>
            </li>
          ))}
          {[...users].length === 0 ? <li className="px-5 py-8 text-center text-sm text-ink-3">Nobody has signed in yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
