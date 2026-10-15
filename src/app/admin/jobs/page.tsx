import Link from "next/link";
import { redact } from "@/lib/errors";
import { explain, problemCode } from "@/lib/problems";
import { health } from "@/lib/health";
import { discardJob, retryJob } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";
import { LocalTime } from "@/components/local-time";

export default async function AdminJobs() {
  const h = await health();
  const queues = [...new Set(h.jobs.map((j) => j.name))].sort();
  const n = (name: string, state: string) => h.jobs.find((j) => j.name === name && j.state === state)?.count ?? 0;
  return (
    <div className="grid gap-4">
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-3">
            <tr>
              <th className="px-5 py-3 font-medium">Queue</th>
              {["waiting", "running", "done", "failed"].map((h) => (
                <th key={h} className="px-3 py-3 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono">
            {queues.map((q) => (
              <tr key={q}>
                <td className="px-5 py-2">{q}</td>
                <td className="px-3 py-2 text-right">{n(q, "created") + n(q, "retry")}</td>
                <td className="px-3 py-2 text-right">{n(q, "active")}</td>
                <td className="px-3 py-2 text-right text-ink-3">{n(q, "completed")}</td>
                <td className={`px-3 py-2 text-right ${n(q, "failed") ? "text-bad" : ""}`}>{n(q, "failed")}</td>
              </tr>
            ))}
            {queues.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center font-sans text-ink-3">
                  No jobs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">
          Failed jobs <span className="font-normal text-ink-3">· identical failures (same job, project and error) are grouped</span>
        </h2>
        <ul className="divide-y divide-line">
          {h.failedGroups.map((g) => (
            <li key={`${g.name}:${g.ids[0]}`} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {g.count > 1 ? (
                    <span className="rounded-full bg-bad/15 px-2 py-0.5 font-mono text-xs text-bad" title={`${g.count} identical failures`}>
                      ×{g.count}
                    </span>
                  ) : null}
                  <span className="font-mono">{g.name}</span>
                  {g.project ? (
                    <Link href={`/manage/${g.project.owner}/${g.project.repo}`} className="truncate text-accent hover:underline">
                      {g.project.owner}/{g.project.repo}
                    </Link>
                  ) : (
                    <span className="truncate font-mono text-xs text-ink-3">{JSON.stringify(g.data)}</span>
                  )}
                </div>
                <div className="text-sm text-ink-2">{explain(problemCode(g.message)).title}</div>
                <div className="truncate font-mono text-xs text-bad" title={redact(g.message)}>
                  {redact(g.message)}
                </div>
                <div className="text-xs text-ink-3">
                  {g.count > 1 ? (
                    <>
                      {g.count} times, <LocalTime value={g.firstAt} /> to <LocalTime value={g.lastAt} />
                    </>
                  ) : (
                    <LocalTime value={g.lastAt} />
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <ActionButton action={retryJob} fields={{ name: g.name, id: g.ids[0] }} label={g.count > 1 ? "Retry latest" : "Retry"} />
                <ConfirmButton
                  action={discardJob}
                  fields={{ name: g.name, id: g.ids.join(",") }}
                  label={g.count > 1 ? `Discard all ${g.count}` : "Discard"}
                  confirm={g.count > 1 ? `Discard ${g.count}` : "Discard"}
                />
              </div>
            </li>
          ))}
          {h.failedGroups.length === 0 ? <li className="px-5 py-8 text-center text-sm text-ink-3">Nothing has failed.</li> : null}
        </ul>
      </section>
    </div>
  );
}
