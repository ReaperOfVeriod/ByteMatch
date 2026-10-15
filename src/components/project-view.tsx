import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Project } from "@/db/schema";
import type { Measures } from "@/report/types";
import { findProject, hasImportedHistory, history, latestFullReport, loadReport } from "@/db/store";
import { projectJsonLd, projectSeoInput } from "@/lib/seo";
import { JsonLd } from "./json-ld";
import { config } from "@/lib/config";
import { platformName } from "@/lib/platforms";
import { publicError } from "@/lib/errors";
import { hiddenFromPublic } from "@/lib/visibility";
import { NotFound, repoUrl, resolve } from "@/lib/project-data";
import { formatBytes } from "@/report/measures";
import { CopyField } from "./copy-field";
import { ExternalImage } from "./external-image";
import { Chat, ChevronRight, GitHubMark } from "./ui/icons";
import { VersionSelect } from "./version-select";
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
      <div className="mt-0.5 font-mono text-xl font-semibold">{value}</div>
      {detail ? <div className="mt-0.5 text-xs text-ink-2">{detail}</div> : null}
    </div>
  );
}

/** A titled panel in the right-hand column (stacked under the grid on narrow screens). */
function Side({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-3.5 flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {aside ? <span className="text-xs font-normal text-ink-3">{aside}</span> : null}
      </h2>
      {children}
    </section>
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

const fmtDateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function Syncing({ project }: { project: Project }) {
  return (
    <div className="mx-auto max-w-2xl">
      <section className="panel p-7">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{project.name}</h1>
        <div className="mt-1 text-sm text-ink-3">
          <a href={repoUrl(project)} className="hover:text-ink">
            {project.owner}/{project.repo}
          </a>
          {project.platform ? ` · ${platformName(project.platform)}` : ""}
        </div>
        <p className="mt-6 text-sm leading-relaxed text-ink-2">
          No progress reports yet. ByteMatch imports the project&apos;s decomp.dev history, if it had one, and reads its CI runs on{" "}
          <code className="rounded bg-code px-1.5 py-0.5 font-mono text-xs">{project.defaultBranch}</code> for{" "}
          <code className="rounded bg-code px-1.5 py-0.5 font-mono text-xs">{"<VERSION>_report"}</code> artifacts. This usually takes a
          minute or two.
        </p>
        {project.lastError ? (
          <p className="mt-4 rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm text-bad">{publicError(project.lastError)}</p>
        ) : project.lastPolledAt ? (
          <p className="mt-4 text-sm text-ink-3">Last checked {fmtDateTime.format(project.lastPolledAt)}: no report artifacts found yet.</p>
        ) : null}
      </section>
    </div>
  );
}

/** The code bar: fully linked (solid), matched (striped), and the rest of the fuzzy match (faint stripes). */
function CodeBar({ m }: { m: Measures }) {
  const linked = Math.min(100, m.complete_code_percent);
  const matched = Math.max(0, Math.min(100, m.matched_code_percent) - linked);
  const fuzzy = Math.max(0, Math.min(100, m.fuzzy_match_percent) - linked - matched);
  const stripes = (a: string, b: string) => `repeating-linear-gradient(135deg, ${a} 0 7px, ${b} 7px 14px)`;
  return (
    <div>
      <div
        className="flex h-4 w-full overflow-hidden rounded-full bg-track"
        role="img"
        aria-label={`${m.complete_code_percent.toFixed(2)}% fully linked, ${m.matched_code_percent.toFixed(2)}% matched, ${m.fuzzy_match_percent.toFixed(2)}% fuzzy match`}
      >
        <div className="h-full bg-done" style={{ width: `${linked}%` }} />
        <div className="h-full" style={{ width: `${matched}%`, background: stripes("var(--done)", "#25863d") }} />
        <div className="h-full" style={{ width: `${fuzzy}%`, background: stripes("#3b4a63", "#2c3850") }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-done" /> Fully linked {m.complete_code_percent.toFixed(2)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: stripes("var(--done)", "#25863d") }} /> Matched{" "}
          {m.matched_code_percent.toFixed(2)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: stripes("#3b4a63", "#2c3850") }} /> Fuzzy{" "}
          {m.fuzzy_match_percent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export async function ProjectView({ owner, repo, version, commit }: { owner: string; repo: string; version?: string; commit?: string }) {
  let r;
  try {
    r = await resolve(owner, repo, version ? decodeURIComponent(version) : undefined, null, commit);
  } catch (e) {
    if (!(e instanceof NotFound)) throw e;
    // A registered project whose first reports have not arrived yet: say so instead of 404.
    const pending = version || commit ? undefined : await findProject(owner, repo);
    if (!pending || hiddenFromPublic(pending, false)) notFound();
    return <Syncing project={pending} />;
  }
  const { project, measures: m, row } = r;
  const base = `/${project.owner}/${project.repo}`;
  const pagePath = version ? `${base}/${encodeURIComponent(r.version)}` : base;
  const [rows, latestFull, imported] = await Promise.all([
    history(project.id, r.version),
    commit ? Promise.resolve(undefined) : latestFullReport(project.id, r.version),
    hasImportedHistory(project.id),
  ]);
  // A past commit shows its own units (if its full report is stored); the latest view shows the newest stored breakdown.
  const unitsRow = commit ? (row.blobId ? row : undefined) : latestFull;
  const report = unitsRow ? await loadReport(unitsRow) : null;

  const at = rows.findIndex((h) => h.commitSha === row.commitSha);
  const older = at > 0 ? rows[at - 1] : undefined;
  const newer = at >= 0 && at < rows.length - 1 ? rows[at + 1] : undefined;
  const commitHref = (sha?: string) => (sha && sha !== rows.at(-1)?.commitSha ? `${pagePath}?commit=${sha.slice(0, 12)}` : pagePath);

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
  const navBtn = "btn btn-ghost h-9 flex-1 px-3 text-sm";
  const navOff = "btn h-9 flex-1 cursor-not-allowed border border-line px-3 text-sm text-ink-3 opacity-50";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <JsonLd data={projectJsonLd(projectSeoInput(r, { versionInUrl: !!version, importedFromDecompDev: imported }))} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/" className="text-ink-3 hover:text-ink">
          Projects
        </Link>
        <ChevronRight size={12} className="text-ink-3" />
        <Link href={base} className="max-w-[60vw] truncate font-medium text-ink hover:underline">
          {project.name}
        </Link>
        <ChevronRight size={12} className="text-ink-3" />
        {r.versions.length > 1 ? (
          <VersionSelect base={base} versions={r.versions} current={r.version} defaultVersion={project.defaultVersion ?? r.versions[0]} />
        ) : (
          <span className="font-mono text-xs text-ink-2">{r.version}</span>
        )}
        {project.discordUrl ? (
          <a href={project.discordUrl} rel="noopener noreferrer" target="_blank" className="btn btn-ghost ml-auto h-9 px-3 text-sm">
            <Chat size={14} />
            Discord
          </a>
        ) : null}
        <a href={repoUrl(project)} className={`btn btn-ghost h-9 px-3 text-sm ${project.discordUrl ? "" : "ml-auto"}`}>
          <GitHubMark size={14} />
          Repository
        </a>
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <section className="panel overflow-hidden">
            {project.imageUrl ? (
              <ExternalImage src={project.imageUrl} className="aspect-[3/1] max-h-56 w-full border-b border-line object-cover" />
            ) : null}
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                {project.iconUrl ? (
                  <ExternalImage src={project.iconUrl} className="size-14 shrink-0 rounded-xl border border-line object-cover sm:size-16" />
                ) : null}
                <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  {project.name} is {m.matched_code_percent.toFixed(2)}% decompiled
                </h1>
              </div>
              <p className="mt-1 text-base font-medium text-ink-3">
                {m.complete_code_percent.toFixed(2)}% fully linked
                {project.platform ? <span className="font-normal"> · {platformName(project.platform)}</span> : null}
              </p>

              <div className="mt-6">
                <div className="mb-2 text-sm text-ink-2">
                  Code <span className="text-ink-3">({formatBytes(m.total_code)})</span>
                </div>
                <CodeBar m={m} />
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <div className="mb-3 truncate font-mono text-[13px] text-ink-2">
                  <a href={`${repoUrl(project)}/commit/${row.commitSha}`} className="text-accent hover:underline">
                    {row.commitSha.slice(0, 7)}
                  </a>{" "}
                  <span className="text-ink-3">|</span> {row.commitMessage?.split("\n")[0] ?? ""}
                  <span className="text-ink-3"> · {fmtDate.format(row.commitTimestamp)}</span>
                </div>
                <div className="flex gap-2">
                  {older ? (
                    <Link href={commitHref(older.commitSha)} className={navBtn} scroll={false}>
                      <ChevronRight size={14} className="rotate-180" />
                      Previous
                    </Link>
                  ) : (
                    <span className={navOff} aria-disabled>
                      <ChevronRight size={14} className="rotate-180" />
                      Previous
                    </span>
                  )}
                  {newer ? (
                    <Link href={commitHref(newer.commitSha)} className={navBtn} scroll={false}>
                      Next
                      <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <span className={navOff} aria-disabled>
                      Next
                      <ChevronRight size={14} />
                    </span>
                  )}
                  {commit ? (
                    <Link href={pagePath} className="btn btn-primary h-9 flex-1 px-3 text-sm" scroll={false}>
                      Latest
                    </Link>
                  ) : (
                    <span className="btn h-9 flex-1 border border-line bg-surface-2 px-3 text-sm text-ink-2" aria-current="true">
                      Latest
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            {report ? (
              <Suspense fallback={<div className="h-[clamp(360px,calc(100vh-360px),720px)]" />}>
                <UnitMap
                  units={mapUnits}
                  categories={row.categories.map((c) => ({ id: c.id, name: c.name }))}
                  owner={project.owner}
                  repo={project.repo}
                  version={r.version}
                  commit={commit ? row.commitSha : null}
                />
              </Suspense>
            ) : (
              <p className="py-10 text-center text-sm text-ink-3">
                {commit
                  ? "No unit breakdown is stored for this commit (it came from decomp.dev's history, which keeps totals only)."
                  : "No unit breakdown stored for this version yet."}
              </p>
            )}
          </section>

          {report ? (
            <More title="Unit list" aside={`${fmt.format(units.length)} units`}>
              <UnitTable units={units} owner={project.owner} repo={project.repo} version={r.version} />
            </More>
          ) : null}
        </div>

        <aside className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:sticky xl:top-20" aria-label="Project details">
          <Side title="Details">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Stat
                label="Code matched"
                value={`${m.matched_code_percent.toFixed(2)}%`}
                detail={`${formatBytes(m.matched_code)} of ${formatBytes(m.total_code)}`}
              />
              <Stat
                label="Functions"
                value={fmt.format(m.matched_functions)}
                detail={`of ${fmt.format(m.total_functions)} (${m.matched_functions_percent.toFixed(1)}%)`}
              />
              <Stat label="Fuzzy match" value={`${m.fuzzy_match_percent.toFixed(2)}%`} detail="incl. partial matches" />
              {m.total_data > 0 ? (
                <Stat
                  label="Data matched"
                  value={`${m.matched_data_percent.toFixed(2)}%`}
                  detail={`${formatBytes(m.matched_data)} of ${formatBytes(m.total_data)}`}
                />
              ) : (
                <Stat label="Units complete" value={`${fmt.format(m.complete_units)}`} detail={`of ${fmt.format(m.total_units)}`} />
              )}
            </div>
          </Side>

          <Side title="History" aside={`${fmt.format(points.length)} commits`}>
            <HistoryChart points={points} />
          </Side>

          {row.categories.length > 0 ? (
            <Side title="Categories" aside={`${row.categories.length}`}>
              <div className="-mr-2 grid max-h-72 grid-cols-[minmax(0,1fr)] gap-y-3 overflow-y-auto pr-2">
                {row.categories.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate">{c.name || c.id}</span>
                      <span className="shrink-0 font-mono text-xs text-ink-2">{c.measures.matched_code_percent.toFixed(2)}%</span>
                    </div>
                    <ProgressBar value={c.measures.matched_code_percent} label={`${c.name || c.id}: code matched`} />
                  </div>
                ))}
              </div>
            </Side>
          ) : null}

          <Side title="Recent commits">
            <ul className="-mx-1 grid grid-cols-[minmax(0,1fr)]">
              {recent.slice(0, 8).map((h) => {
                const p = previous.get(h.commitSha);
                const dCode = p ? h.measures.matched_code_percent - p.matched_code_percent : 0;
                const here = h.commitSha === row.commitSha;
                return (
                  <li key={h.commitSha}>
                    <Link
                      href={commitHref(h.commitSha)}
                      scroll={false}
                      title={`${fmtDate.format(h.commitTimestamp)} · ${h.measures.matched_code_percent.toFixed(2)}%`}
                      className={`flex items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] transition-colors hover:bg-surface-2 ${here ? "bg-surface-2" : ""}`}
                    >
                      <span className="shrink-0 font-mono text-xs text-ink-3">{h.commitSha.slice(0, 7)}</span>
                      <span className="min-w-0 truncate text-ink-2">{h.commitMessage?.split("\n")[0] ?? ""}</span>
                      {Math.abs(dCode) >= 0.005 ? (
                        <span className={`ml-auto shrink-0 font-mono text-xs ${dCode > 0 ? "text-good" : "text-bad"}`}>
                          {dCode > 0 ? "+" : "−"}
                          {Math.abs(dCode).toFixed(2)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Side>

          <Side title="Badges">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
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
          </Side>
        </aside>
      </div>
    </div>
  );
}
