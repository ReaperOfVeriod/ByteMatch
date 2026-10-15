import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManage, currentSession } from "@/auth/session";
import { findProject, projectVersions } from "@/db/store";
import { config } from "@/lib/config";
import { PLATFORMS } from "@/lib/platforms";
import { listTokens } from "@/lib/tokens";
import { deleteToken, newToken, runAction, updateProject } from "../../actions";
import { Select } from "@/components/ui/select";
import { ChevronRight } from "@/components/ui/icons";
import { ActionButtons, ActionForm, inputClass } from "../../forms";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ added?: string }> };

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel mt-5 p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span>
        {label} {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export default async function ManageProject({ params, searchParams }: Params) {
  const { owner, repo } = await params;
  const session = await currentSession();
  if (!session) redirect(`/login?next=/manage/${owner}/${repo}`);
  const project = await findProject(owner, repo);
  if (!project || !(await canManage(session, project))) notFound();
  const [versions, tokens, { added }] = await Promise.all([projectVersions(project.id), listTokens(project.id), searchParams]);
  const site = config().PUBLIC_URL;
  const slug = config().GITHUB_APP_SLUG;
  const bound = (fn: typeof updateProject) => fn.bind(null, project.owner, project.repo);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <Link href={`/${project.owner}/${project.repo}`} className="ml-auto text-sm text-accent">
          View page →
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-3">
        {project.owner}/{project.repo} ·{" "}
        {versions.length ? `${versions.length} version${versions.length > 1 ? "s" : ""}` : "no reports yet"}
        {project.lastPolledAt ? ` · checked ${fmtDate.format(project.lastPolledAt)}` : ""}
      </p>
      {added ? (
        <p className="mt-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
          Added. ByteMatch is importing its decomp.dev history (if it had any) and reading its CI runs. This takes a minute or two; refresh
          to see progress.
        </p>
      ) : null}
      {project.lastError ? (
        <p className="mt-4 rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm text-bad">
          Last ingest failed{project.lastErrorAt ? ` (${fmtDate.format(project.lastErrorAt)})` : ""}: {project.lastError}
        </p>
      ) : null}

      <Card title="Data">
        <ActionButtons
          action={runAction.bind(null, project.owner, project.repo)}
          buttons={[
            { value: "poll", label: "Check for new runs", hint: "Look for new successful CI runs now" },
            {
              value: "backfill",
              label: "Backfill",
              hint: "Read older CI runs whose artifacts have not expired (GitHub keeps them about 90 days)",
            },
            { value: "import", label: "Import from decomp.dev", hint: "Copy this project's history and latest report from decomp.dev" },
          ]}
        />
        <p className="mt-3 text-xs text-ink-3">
          {project.installationId
            ? "The GitHub App is installed: new runs arrive instantly and pull requests get progress comments."
            : "Without the GitHub App, new runs are picked up every few minutes and pull requests get no comments."}
          {!project.installationId && slug ? (
            <>
              {" "}
              <a className="text-accent" href={`https://github.com/apps/${slug}/installations/new`}>
                Install the App
              </a>
            </>
          ) : null}
        </p>
      </Card>

      <Card title="Settings">
        <ActionForm action={bound(updateProject)} submit="Save">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name">
              <input name="name" defaultValue={project.name} className={inputClass} />
            </Field>
            <Field label="Short name" hint="optional">
              <input name="shortName" defaultValue={project.shortName ?? ""} className={inputClass} />
            </Field>
            <Field label="Platform">
              <Select name="platform" defaultValue={project.platform ?? ""}>
                <option value="">—</option>
                {Object.entries(PLATFORMS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name} ({id})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default version">
              <Select name="defaultVersion" defaultValue={project.defaultVersion ?? ""}>
                <option value="">Most recently updated</option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default branch" hint="runs on this branch are tracked">
              <input name="defaultBranch" defaultValue={project.defaultBranch} className={inputClass} />
            </Field>
            <Field label="Default category" hint="optional category id for badges">
              <input name="defaultCategory" defaultValue={project.defaultCategory ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Description" hint="optional">
            <input name="description" defaultValue={project.description ?? ""} className={inputClass} />
          </Field>
          <details className="group rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-ink-2 select-none hover:text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight size={13} className="text-ink-3 transition-transform duration-200 group-open:rotate-90" />
              Advanced
            </summary>
            <div className="mt-3 grid gap-3">
              <Field label="Artifact name pattern" hint="regex; the version group names the game version">
                <input name="artifactPattern" defaultValue={project.artifactPattern} className={`${inputClass} font-mono`} />
              </Field>
              <Field label="Workflow file" hint="e.g. build.yml; empty reads every workflow">
                <input name="workflow" defaultValue={project.workflow ?? ""} className={inputClass} />
              </Field>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent-strong)]"
                  name="splitVersions"
                  defaultChecked={project.splitVersions}
                />{" "}
                One report holds every version (top-level categories are versions)
              </label>
            </div>
          </details>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" name="prComments" defaultChecked={project.prComments} />{" "}
            Comment on pull requests (needs the GitHub App)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--accent-strong)]" name="enabled" defaultChecked={project.enabled} />{" "}
            Enabled (public page, badges and ingestion)
          </label>
        </ActionForm>
      </Card>

      <Card title="Upload tokens">
        <p className="mb-4 text-sm text-ink-2">
          For CI that can&apos;t upload GitHub artifacts:{" "}
          <code className="font-mono text-xs break-all">
            POST {site}/api/v1/projects/{project.owner}/{project.repo}/reports?version=…&commit=…
          </code>
        </p>
        {tokens.length ? (
          <ul className="mb-4 divide-y divide-line text-sm">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className="font-mono text-xs">{t.prefix}…</span>
                <span>{t.name}</span>
                <span className="text-xs text-ink-3">{t.lastUsedAt ? `used ${fmtDate.format(t.lastUsedAt)}` : "never used"}</span>
                <form action={deleteToken.bind(null, project.owner, project.repo)} className="ml-auto">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-xs text-bad">Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={newToken.bind(null, project.owner, project.repo)} submit="Create token" className="grid gap-3">
          <Field label="Name" hint="e.g. gitlab-ci">
            <input name="name" className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
