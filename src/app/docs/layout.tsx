import { DOCS, loadDoc } from "@/lib/docs";
import { DocsNav } from "./docs-nav";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = (await Promise.all(DOCS.map((d) => loadDoc(d.slug))))
    .filter((d) => d !== null)
    .map((d) => ({ slug: d.slug, title: d.title, group: d.group }));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel p-3">
          <DocsNav docs={docs} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
