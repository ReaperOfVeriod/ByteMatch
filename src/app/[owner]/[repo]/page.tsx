import type { Metadata } from "next";
import { ProjectView } from "@/components/project-view";
import { findProject } from "@/db/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { owner, repo } = await params;
  const p = await findProject(owner, repo);
  return { title: p?.name ?? `${owner}/${repo}` };
}

export default async function Page({ params }: Params) {
  const { owner, repo } = await params;
  return <ProjectView owner={owner} repo={repo} />;
}
