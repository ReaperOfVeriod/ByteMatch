import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { redact } from "@/lib/errors";
import { clearDiscord, clearImage, removeProject, resyncProject, toggleProject } from "../actions";
import { projectStatus, STATUS_STYLE, type ProjectStatus } from "../status";
import { ActionButton, ConfirmButton } from "../ui";

const STATUSES: ("all" | ProjectStatus)[] = ["all", "healthy", "syncing", "erroring", "hidden", "disabled"];
const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

type Params = { searchParams: Promise<{ status?: string; q?: string }> };

export default async function AdminProjects({ searchParams }: Params) {
  const { status = "all", q = "" } = await searchParams;
  const rows = await db().execute<{
    id: number;
    owner: string;
    repo: string;
    name: string;
    enabled: boolean;
    last_error: string | null;
    last_polled_at: string | null;
    installation_id: number | null;
    image_url: string | null;
    discord_url: string | null;
    created_at: string;
    submitter: string | null;
    reports: number;
  }>(sql`
    select p.id, p.owner, p.repo, p.name, p.enabled, p.last_error, p.last_polled_at, p.installation_id, p.image_url,
           p.discord_url, p.created_at, u.login as submitter,
           (select count(*) from reports r where r.project_id = p.id)::int as reports
    from projects p left join users u on u.id = p.created_by
    order by p.created_at desc`);
  const all = [...rows].map((p) => ({ ...p, status: projectStatus({ enabled: p.enabled, lastError: p.last_error }, p.reports > 0) }));
  const needle = q.trim().toLowerCase();
  const shown = all.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (!needle || `${p.name} ${p.owner}/${p.repo} ${p.submitter ?? ""}`.toLowerCase().includes(needle)),
  );
  const count = (s: string) => (s === "all" ? all.length : all.filter((p) => p.status === s).length);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="segmented flex-wrap" aria-label="Status">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/projects?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-pressed={status === s}
              className={`rounded-[0.45rem] px-2.5 py-1 text-xs capitalize ${status === s ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {s} <span className="text-ink-3">{count(s)}</span>
            </Link>
          ))}
        </nav>
        <form className="ml-auto w-full sm:w-64">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Search name, repo or submitter" className="field" aria-label="Search projects" />
        </form>
      </div>

      <ul className="panel divide-y divide-line overflow-hidden">
        {shown.map((p) => (
          <li key={p.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/manage/${p.owner}/${p.repo}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                {p.installation_id ? (
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-2">App installed</span>
                ) : null}
              </div>
              <div className="mt-0.5 truncate text-xs text-ink-3">
                <a href={`https://github.com/${p.owner}/${p.repo}`} className="hover:text-ink">
                  {p.owner}/{p.repo}
                </a>
                {" · "}submitted by {p.submitter ?? "unknown"} · {p.reports} reports · checked{" "}
                {p.last_polled_at ? fmtDate.format(new Date(p.last_polled_at)) : "never"}
              </div>
              {p.last_error ? <div className="mt-1 truncate font-mono text-xs text-[#f0b429]">{redact(p.last_error)}</div> : null}
              {p.image_url ? (
                <div className="mt-1 truncate text-xs text-ink-3">
                  Image:{" "}
                  <a href={p.image_url} rel="noopener noreferrer" target="_blank" className="underline">
                    {p.image_url}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1 lg:justify-end">
              <ActionButton action={resyncProject} fields={{ id: String(p.id) }} label="Re-sync" />
              <ActionButton
                action={toggleProject}
                fields={{ id: String(p.id), enabled: String(!p.enabled) }}
                label={p.enabled ? "Disable" : "Enable"}
              />
              {p.image_url ? (
                <ConfirmButton action={clearImage} fields={{ id: String(p.id) }} label="Remove image" confirm="Remove image" />
              ) : null}
              {p.discord_url ? (
                <ConfirmButton action={clearDiscord} fields={{ id: String(p.id) }} label="Remove Discord" confirm="Remove link" />
              ) : null}
              <ConfirmButton action={removeProject} fields={{ id: String(p.id) }} label="Delete" confirm={`Delete ${p.repo}`} reason />
            </div>
          </li>
        ))}
        {shown.length === 0 ? <li className="px-5 py-10 text-center text-sm text-ink-3">No projects here.</li> : null}
      </ul>
    </div>
  );
}
