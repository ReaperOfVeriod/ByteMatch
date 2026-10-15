import Link from "next/link";
import { ProjectList, type ProjectRow } from "@/components/project-list";
import { Plus } from "@/components/ui/icons";
import { projectIndex } from "@/db/store";
import { config } from "@/lib/config";
import { platformName } from "@/lib/platforms";
import { homeMetadata } from "@/lib/seo";

export function generateMetadata() {
  return homeMetadata();
}

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
      <div className="mb-8 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Decompilation progress</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Matching decompilation projects tracked by {config().SITE_NAME}, from the objdiff reports their CI builds. Code matched is the
            share of the game&apos;s code that compiles back to identical bytes.
          </p>
        </div>
        <Link href="/manage/new" className="btn btn-primary sm:ml-auto">
          <Plus size={14} />
          Submit a project
        </Link>
      </div>
      <ProjectList rows={rows} />
    </div>
  );
}
