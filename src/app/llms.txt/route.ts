import { projectIndex } from "@/db/store";
import { config } from "@/lib/config";
import { platformName } from "@/lib/platforms";
import { DOCS_SEO, SITE_DESCRIPTION, projectPath } from "@/lib/seo";

/** /llms.txt (llmstxt.org): a plain-text summary of the site for language-model crawlers. */
export const dynamic = "force-dynamic";

export async function GET() {
  const c = config();
  const base = c.PUBLIC_URL;
  const name = c.SITE_NAME;

  let projects = "";
  try {
    const rows = await projectIndex();
    projects = rows
      .map((p) => {
        const platform = platformName(p.platform);
        const progress = p.measures ? `: ${Number(p.measures.matched_code_percent).toFixed(2)}% code matched` : "";
        return `- [${p.name}](${base}${projectPath({ owner: p.owner, repo: p.repo })})${platform ? ` (${platform})` : ""}${progress}`;
      })
      .join("\n");
  } catch {
    projects = `- The list is temporarily unavailable; see ${base}/api/v1/projects`;
  }

  const docs = Object.entries(DOCS_SEO)
    .map(([slug, d]) => `- [${d.title}](${base}/docs/${slug}): ${d.description}`)
    .join("\n");

  const body = `# ${name}

> ${SITE_DESCRIPTION}

${name === "ByteMatch" ? "ByteMatch is" : `${name} runs ByteMatch,`} open-source (GPL-3.0) software: https://github.com/Veradictus/ByteMatch. It reads objdiff progress reports that decompilation projects' CI uploads, and shows each project's code matched, functions matched, history, unit map and badges.

ByteMatch is not decomp.dev. decomp.dev was the community's decompilation progress site; it is being sunset and no longer accepts new projects. ByteMatch is an independent, clean-room successor that serves the same public URL shapes, so badges and tools move over by changing the domain. Projects can import their history from decomp.dev.

## Docs

${docs}

## Public URLs

- ${base}/{owner}/{repo}: project page (HTML), default version
- ${base}/{owner}/{repo}/{version}: project page for one version
- ${base}/{owner}/{repo}.json and ${base}/{owner}/{repo}/{version}.json: project JSON (current measures, versions, categories); ?mode=shield|history|report|measures
- ${base}/{owner}/{repo}.svg and .png: progress badges; query parameters such as ?measure=, ?label=, ?category=, ?style= are compatible with decomp.dev badge URLs
- ${base}/api/v1/projects: list of projects (JSON)
- POST ${base}/api/v1/projects/{owner}/{repo}/reports: upload a report (token required)

{owner} and {repo} are the GitHub owner and repository name.

## Projects

${projects}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
