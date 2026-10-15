import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/ui/icons";
import { DOCS, loadDoc } from "@/lib/docs";
import { docsIndexMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return docsIndexMetadata();
}

export default async function DocsIndex() {
  const docs = (await Promise.all(DOCS.map((d) => loadDoc(d.slug)))).filter((d) => d !== null);
  const groups = [...new Set(docs.map((d) => d.group))];
  return (
    <div className="grid gap-5">
      <section className="panel p-7">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Track a matching decompilation on ByteMatch from the objdiff reports your CI already builds. New here? Start with{" "}
          <Link href="/docs/getting-started" className="text-accent hover:underline">
            Getting started
          </Link>
          . Coming from decomp.dev?{" "}
          <Link href="/docs/migrating-from-decomp-dev" className="text-accent hover:underline">
            Move your project
          </Link>{" "}
          without losing its history.
        </p>
      </section>
      {groups.map((g) => (
        <section key={g} className="panel overflow-hidden">
          <h2 className="border-b border-line px-6 py-3.5 text-sm font-semibold">{g}</h2>
          <ul className="divide-y divide-line">
            {docs
              .filter((d) => d.group === g)
              .map((d) => (
                <li key={d.slug}>
                  <Link href={`/docs/${d.slug}`} className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-2">
                    <div className="min-w-0">
                      <div className="font-medium">{d.title}</div>
                      <div className="mt-0.5 text-sm text-ink-2">{d.summary}</div>
                    </div>
                    <ArrowRight
                      size={15}
                      className="ml-auto shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
