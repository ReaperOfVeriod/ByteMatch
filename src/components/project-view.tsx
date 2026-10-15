import Link from "next/link";
import { notFound } from "next/navigation";
import { history, latestFullReport, loadReport } from "@/db/store";
import { config } from "@/lib/config";
import { platformName } from "@/lib/platforms";
import { NotFound, repoUrl, resolve } from "@/lib/project-data";
import { formatBytes } from "@/report/measures";
import { CopyField } from "./copy-field";
import { HistoryChart, type HistoryPoint } from "./history-chart";
import { ProgressBar } from "./progress-bar";
import { UnitTable, type UnitRow } from "./unit-table";

const fmt = new Intl.NumberFormat("en-US");
const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {detail ? <div className="mt-0.5 text-xs text-ink-2">{detail}</div> : null}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export async function ProjectView({ owner, repo, version }: { owner: string; repo: string; version?: string }) {
  let r;
  try {
    r = await resolve(owner, repo, version ? decodeURIComponent(version) : undefined, null);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }
  const { project, measures: m, row } = r;
  const base = `/${project.owner}/${project.repo}`;
  const [rows, fullRow] = await Promise.all([history(project.id, r.version), latestFullReport(project.id, r.version)]);
  const report = fullRow ? await loadReport(fullRow) : null;

  const points: HistoryPoint[] = rows.map((h) => ({
    t: h.commitTimestamp.getTime(),
    code: h.measures.matched_code_percent,
    functions: h.measures.matched_functions_percent,
    sha: h.commitSha,
    message: h.commitMessage,
    matchedFunctions: h.measures.matched_functions,
    totalFunctions: h.measures.total_functions,
  }));
  const units: UnitRow[] = (report?.units ?? []).map((u) => ({
    name: u.name,
    totalCode: u.measures.total_code,
    matchedCodePercent: u.measures.matched_code_percent,
    fuzzy: u.measures.fuzzy_match_percent,
    matchedFunctions: u.measures.matched_functions,
    totalFunctions: u.measures.total_functions,
    complete: !!u.metadata?.complete,
  }));
  const recent = rows.slice(-15).reverse();
  const previous = new Map(rows.map((h, i) => [h.commitSha, rows[i - 1]?.measures]));
  const site = config().PUBLIC_URL;
  const versionPath = version ? `/${encodeURIComponent(r.version)}` : "";

  return (
    <div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <div className="mt-1 text-sm text-ink-2">
            <a href={repoUrl(project)} className="underline-offset-2 hover:underline">
              {project.owner}/{project.repo}
            </a>
            {project.platform ? ` · ${platformName(project.platform)}` : ""}
            {` · updated ${fmtDate.format(row.commitTimestamp)}`}
          </div>
          {project.description ? <p className="mt-2 max-w-2xl text-sm text-ink-2">{project.description}</p> : null}
        </div>
        {r.versions.length > 1 ? (
          <nav className="ml-auto flex flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5 text-sm" aria-label="Game version">
            {r.versions.map((v) => (
              <Link
                key={v}
                href={`${base}/${encodeURIComponent(v)}`}
                aria-current={v === r.version ? "page" : undefined}
                className={`rounded px-2.5 py-1 font-mono text-xs ${v === r.version ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {v}
              </Link>
            ))}
          </nav>
        ) : (
          <span className="ml-auto rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-2">{r.version}</span>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Code matched"
          value={`${m.matched_code_percent.toFixed(2)}%`}
          detail={`${formatBytes(m.matched_code)} of ${formatBytes(m.total_code)}`}
        />
        <Stat
          label="Functions matched"
          value={`${m.matched_functions_percent.toFixed(2)}%`}
          detail={`${fmt.format(m.matched_functions)} of ${fmt.format(m.total_functions)}`}
        />
        <Stat label="Fuzzy match" value={`${m.fuzzy_match_percent.toFixed(2)}%`} detail="including partly matched code" />
        {m.total_data > 0 ? (
          <Stat
            label="Data matched"
            value={`${m.matched_data_percent.toFixed(2)}%`}
            detail={`${formatBytes(m.matched_data)} of ${formatBytes(m.total_data)}`}
          />
        ) : (
          <Stat
            label="Units complete"
            value={`${fmt.format(m.complete_units)} / ${fmt.format(m.total_units)}`}
            detail={`${m.complete_code_percent.toFixed(2)}% of code linked`}
          />
        )}
      </div>

      <Section title="History" aside={<span className="text-xs text-ink-3">{fmt.format(points.length)} commits</span>}>
        <div className="rounded-lg border border-line bg-surface p-4">
          <HistoryChart points={points} />
        </div>
      </Section>

      {row.categories.length > 0 ? (
        <Section title="Categories">
          <div className="grid gap-x-8 gap-y-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
            {row.categories.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{c.name || c.id}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-2 tabular-nums">
                    {c.measures.matched_code_percent.toFixed(2)}% · {fmt.format(c.measures.matched_functions)} /{" "}
                    {fmt.format(c.measures.total_functions)} fn
                  </span>
                </div>
                <ProgressBar value={c.measures.matched_code_percent} label={`${c.name || c.id}: code matched`} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="Units"
        aside={
          fullRow && fullRow.commitSha !== row.commitSha ? (
            <span className="text-xs text-ink-3">from commit {fullRow.commitSha.slice(0, 7)}</span>
          ) : null
        }
      >
        {report ? (
          <UnitTable units={units} owner={project.owner} repo={project.repo} version={r.version} />
        ) : (
          <p className="text-sm text-ink-3">No full report stored for this version.</p>
        )}
      </Section>

      <Section title="Recent commits">
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3">
              <tr>
                <th className="px-3 py-2 font-medium">Commit</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Code</th>
                <th className="px-3 py-2 text-right font-medium">Functions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((h) => {
                const p = previous.get(h.commitSha);
                const dFn = p ? h.measures.matched_functions - p.matched_functions : 0;
                const dCode = p ? h.measures.matched_code_percent - p.matched_code_percent : 0;
                return (
                  <tr key={h.commitSha}>
                    <td className="max-w-0 px-3 py-1.5">
                      <a href={`${repoUrl(project)}/commit/${h.commitSha}`} className="flex gap-2 hover:underline">
                        <span className="shrink-0 font-mono text-xs text-ink-3">{h.commitSha.slice(0, 7)}</span>
                        <span className="truncate">{h.commitMessage?.split("\n")[0] ?? ""}</span>
                      </a>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">{fmtDate.format(h.commitTimestamp)}</td>
                    <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                      {h.measures.matched_code_percent.toFixed(2)}%
                      {Math.abs(dCode) >= 0.005 ? (
                        <span className={`ml-1.5 text-xs ${dCode > 0 ? "text-good" : "text-bad"}`}>
                          {dCode > 0 ? "+" : "−"}
                          {Math.abs(dCode).toFixed(2)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                      {fmt.format(h.measures.matched_functions)}
                      {dFn !== 0 ? (
                        <span className={`ml-1.5 text-xs ${dFn > 0 ? "text-good" : "text-bad"}`}>
                          {dFn > 0 ? "+" : "−"}
                          {fmt.format(Math.abs(dFn))}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Badges">
        <div className="grid gap-4 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- badges are tiny SVGs served by this site */}
            <img alt="Code badge" src={`${base}${versionPath}.svg?mode=shield&label=Code&measure=matched_code_percent`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Functions badge" src={`${base}${versionPath}.svg?mode=shield&label=Functions&measure=matched_functions`} />
          </div>
          <CopyField
            label="Code"
            value={`[![Code](${site}${base}${versionPath}.svg?mode=shield&label=Code&measure=matched_code_percent)](${site}${base})`}
          />
          <CopyField
            label="Functions"
            value={`[![Functions](${site}${base}${versionPath}.svg?mode=shield&label=Functions&measure=matched_functions)](${site}${base})`}
          />
          <CopyField label="JSON" value={`${site}${base}${versionPath}.json`} />
        </div>
      </Section>
    </div>
  );
}
