import { redact } from "@/lib/errors";
import { health } from "@/lib/health";
import { discardJob, retryJob } from "../actions";
import { ActionButton, ConfirmButton } from "../ui";

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function errorText(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const o = output as { message?: string; stack?: string };
  return redact(o.message ?? JSON.stringify(output));
}

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
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Failed jobs (latest 50)</h2>
        <ul className="divide-y divide-line">
          {h.failedRecent.map((j) => (
            <li key={j.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono">{j.name}</span>
                  <span className="truncate font-mono text-xs text-ink-3">{JSON.stringify(j.data)}</span>
                </div>
                <div className="truncate font-mono text-xs text-bad">{errorText(j.output)}</div>
                <div className="text-xs text-ink-3">{fmtDate.format(new Date(j.completedOn ?? j.createdOn))}</div>
              </div>
              <div className="flex gap-1">
                <ActionButton action={retryJob} fields={{ name: j.name, id: j.id }} label="Retry" />
                <ConfirmButton action={discardJob} fields={{ name: j.name, id: j.id }} label="Discard" confirm="Discard" />
              </div>
            </li>
          ))}
          {h.failedRecent.length === 0 ? <li className="px-5 py-8 text-center text-sm text-ink-3">Nothing has failed.</li> : null}
        </ul>
      </section>
    </div>
  );
}
