import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { ArrowRight } from "@/components/ui/icons";
import { JsonLd } from "@/components/json-ld";
import { DOCS, loadDoc } from "@/lib/docs";
import { breadcrumbJsonLd, docsJsonLd, docsPageMetadata } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const doc = await loadDoc((await params).slug);
  return doc ? docsPageMetadata(doc.slug, { title: doc.title, description: doc.summary }) : {};
}

export default async function DocPage({ params }: Params) {
  const { slug } = await params;
  const doc = await loadDoc(slug);
  if (!doc) notFound();
  const index = DOCS.findIndex((d) => d.slug === slug);
  const next = DOCS[index + 1] ? await loadDoc(DOCS[index + 1].slug) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)]">
      <article className="panel min-w-0 px-6 py-8 sm:px-10 lg:px-12">
        <JsonLd data={docsJsonLd(doc.slug, { title: doc.title, description: doc.summary })} />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Docs", path: "/docs" },
            { name: doc.title, path: `/docs/${doc.slug}` },
          ])}
        />
        <div className="text-xs font-medium text-ink-3">{doc.group}</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{doc.title}</h1>
        <div className="mt-6">
          <Markdown source={doc.body} />
        </div>
        {next ? (
          <Link
            href={`/docs/${next.slug}`}
            className="group mt-12 flex items-center gap-4 rounded-xl border border-line bg-surface-2/50 px-5 py-4 transition-colors hover:border-line-strong"
          >
            <div>
              <div className="text-xs text-ink-3">Next</div>
              <div className="font-medium">{next.title}</div>
            </div>
            <ArrowRight size={15} className="ml-auto text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ) : null}
      </article>
    </div>
  );
}
