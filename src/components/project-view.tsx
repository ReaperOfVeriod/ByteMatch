import Link from "next/link";
import { notFound } from "next/navigation";
import { hasImportedHistory, history, latestFullReport, loadReport } from "@/db/store";
import { projectJsonLd, projectSeoInput } from "@/lib/seo";
import { JsonLd } from "./json-ld";
import { config } from "@/lib/config";
import { platformName } from "@/lib/platforms";
import { NotFound, repoUrl, resolve } from "@/lib/project-data";
import { formatBytes } from "@/report/measures";
import { CopyField } from "./copy-field";
import { ChevronRight } from "./ui/icons";
import { HistoryChart, type HistoryPoint } from "./history-chart";
import { ProgressBar } from "./progress-bar";
import { UnitMap, type MapUnit } from "./unit-map";
import { UnitTable, type UnitRow } from "./unit-table";

const fmt = new Intl.NumberFormat("en-US");
const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="px-1 py-1">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
      {detail ? <div className="mt-0.5 text-xs text-ink-2">{detail}</div> : null}
    </div>
  );
}

/** Extra information, closed until asked for. */
function More({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <details className="panel group overflow-hidden [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm select-none hover:bg-surface-2/60">
        <ChevronRight size={14} className="text-ink-3 transition-transform duration-200 ease-out group-open:rotate-90" />
        <span className="font-medium text-ink">{title}</span>
        {aside ? <span className="text-xs text-ink-3">{aside}</span> : null}
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
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
  const [rows, fullRow, imported] = await Promise.all([
    history(project.id, r.version),
    latestFullReport(project.id, r.version),
    hasImportedHistory(project.id),
  ]);
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
  const mapUnits: MapUnit[] = (report?.units ?? []).map((u) => ({
    name: u.name,
    totalCode: u.measures.total_code,
    matchedCodePercent: u.measures.matched_code_percent,
    fuzzy: u.measures.fuzzy_match_percent,
    matchedFunctions: u.measures.matched_functions,
    totalFunctions: u.measures.total_functions,
    categories: u.metadata?.progress_categories ?? [],
  }));
  const recent = rows.slice(-15).reverse();
  const previous = new Map(rows.map((h, i) => [h.commitSha, rows[i - 1]?.measures]));
  const site = config().PUBLIC_URL;
  const versionPath = version ? `/${encodeURIComponent(r.version)}` : "";

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-5">
      <JsonLd data={projectJsonLd(projectSeoInput(r, { versionInUrl: !!version, importedFromDecompDev: imported }))} />
      <section className="panel p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {project.name} is {m.matched_code_percent.toFixed(2)}% decompiled
          </h1>
          {r.versions.length > 1 ? (
            <nav className="segmented ml-auto flex-wrap" aria-label="Game version">
              {r.versions.map((v) => (
                <Link
                  key={v}
                  href={`${base}/${encodeURIComponent(v)}`}
                  aria-current={v === r.version ? "page" : undefined}
                  className={`rounded-[0.45rem] px-2.5 py-1 font-mono text-xs ${v === r.version ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink"}`}
                >
                  {v}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="mt-1 text-sm text-ink-3">
          <a href={repoUrl(project)} className="hover:text-ink">
            {project.owner}/{project.repo}
          </a>
          {project.platform ? ` · ${platformName(project.platform)}` : ""} · {r.version}
        </div>

        <div className="mt-6">
          <div className="mb-1.5 text-sm text-ink-2">
            Code <span className="text-ink-3">({formatBytes(m.total_code)})</span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(m.matched_code_percent.toFixed(2))}
            aria-label="Code matched"
          >
            <div className="h-full rounded-full bg-done" style={{ width: `${Math.min(100, m.matched_code_percent)}%` }} />
          </div>
        </div>

        <div className="mt-5 truncate border-t border-line pt-4 font-mono text-[13px] text-ink-2">
          <a href={`${repoUrl(project)}/commit/${row.commitSha}`} className="text-accent hover:underline">
            {row.commitSha.slice(0, 7)}
          </a>{" "}
          <span className="text-ink-3">|</span> {row.commitMessage?.split("\n")[0] ?? ""}
          <span className="text-ink-3"> · {fmtDate.format(row.commitTimestamp)}</span>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold">Units</h2>
        {report ? (
          <UnitMap
            units={mapUnits}
            categories={row.categories.map((c) => ({ id: c.id, name: c.name }))}
            owner={project.owner}
            repo={project.repo}
            version={r.version}
          />
        ) : (
          <p className="text-sm text-ink-3">No unit breakdown stored for this version yet.</p>
        )}
      </section>

      <div className="grid gap-3">
        <More title="Details">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line [&>*]:lg:pl-6 [&>*:first-child]:lg:pl-0">
            <Stat
              label="Code matched"
              value={`${m.matched_code_percent.toFixed(2)}%`}
              detail={`${formatBytes(m.matched_code)} of ${formatBytes(m.total_code)}`}
            />
            <Stat
              label="Functions"
              value={`${fmt.format(m.matched_functions)}`}
              detail={`of ${fmt.format(m.total_functions)} (${m.matched_functions_percent.toFixed(2)}%)`}
            />
            <Stat label="Fuzzy match" value={`${m.fuzzy_match_percent.toFixed(2)}%`} detail="counting partly matched code" />
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
        </More>

        <More title="History" aside={`${fmt.format(points.length)} commits`}>
          <div>
            <HistoryChart points={points} />
          </div>
        </More>

        {row.categories.length > 0 ? (
          <More title="Categories" aside={`${row.categories.length}`}>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {row.categories.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{c.name || c.id}</span>
                    <span className="shrink-0 font-mono text-xs text-ink-2">{c.measures.matched_code_percent.toFixed(2)}%</span>
                  </div>
                  <ProgressBar value={c.measures.matched_code_percent} label={`${c.name || c.id}: code matched`} />
                </div>
              ))}
            </div>
          </More>
        ) : null}

        {report ? (
          <More title="Unit list" aside={`${fmt.format(units.length)} units`}>
            <UnitTable units={units} owner={project.owner} repo={project.repo} version={r.version} />
          </More>
        ) : null}

        <More title="Recent commits">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <tbody className="divide-y divide-line">
                {recent.map((h) => {
                  const p = previous.get(h.commitSha);
                  const dCode = p ? h.measures.matched_code_percent - p.matched_code_percent : 0;
                  return (
                    <tr key={h.commitSha}>
                      <td className="max-w-0 py-1.5 pr-3">
                        <a href={`${repoUrl(project)}/commit/${h.commitSha}`} className="flex gap-2 hover:underline">
                          <span className="shrink-0 font-mono text-xs text-ink-3">{h.commitSha.slice(0, 7)}</span>
                          <span className="truncate">{h.commitMessage?.split("\n")[0] ?? ""}</span>
                        </a>
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap text-ink-3">{fmtDate.format(h.commitTimestamp)}</td>
                      <td className="py-1.5 text-right font-mono whitespace-nowrap">
                        {h.measures.matched_code_percent.toFixed(2)}%
                        {Math.abs(dCode) >= 0.005 ? (
                          <span className={`ml-1.5 text-xs ${dCode > 0 ? "text-good" : "text-bad"}`}>
                            {dCode > 0 ? "+" : "−"}
                            {Math.abs(dCode).toFixed(2)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </More>

        <More title="Badges">
          <div className="grid gap-4">
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
        </More>
      </div>
    </div>
  );
}
