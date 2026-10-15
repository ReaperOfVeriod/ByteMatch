import { DOCS, loadDoc } from "@/lib/docs";
import { DocsNav } from "./docs-nav";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = (await Promise.all(DOCS.map((d) => loadDoc(d.slug))))
    .filter((d) => d !== null)
    .map((d) => ({
      slug: d.slug,
      title: d.title,
      group: d.group,
      headings: d.headings.filter((h) => h.depth === 2).map(({ id, text }) => ({ id, text })),
    }));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <div className="panel p-3">
          <DocsNav docs={docs} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
