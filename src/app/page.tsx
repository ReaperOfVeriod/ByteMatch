import { ProjectList, type ProjectRow } from "@/components/project-list";
import { projectIndex } from "@/db/store";
import { config } from "@/lib/config";
import { platformName } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows: ProjectRow[] = (await projectIndex()).map((p) => ({
    owner: p.owner,
    repo: p.repo,
    name: p.name,
    platform: p.platform,
    platformName: platformName(p.platform),
    version: p.version,
    codePercent: p.measures ? Number(p.measures.matched_code_percent) : null,
    functions: p.measures ? { done: Number(p.measures.matched_functions), total: Number(p.measures.total_functions) } : null,
    updated: p.commit_timestamp ? new Date(p.commit_timestamp).toISOString() : null,
  }));
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Decompilation progress</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-2">
        Matching decompilation projects tracked by {config().SITE_NAME}, from the objdiff reports their CI builds. Code matched is the share
        of the game&apos;s code that compiles back to identical bytes.
      </p>
      <ProjectList rows={rows} />
    </div>
  );
}
