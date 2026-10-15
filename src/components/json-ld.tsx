/**
 * Structured data for search engines: <JsonLd data={projectJsonLd(...)} />. A plain <script>, not
 * next/script, since JSON-LD is data, not code. Every "<" is escaped as < so no string in the
 * data can close the tag or open a comment (as Next's JSON-LD guide recommends).
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
