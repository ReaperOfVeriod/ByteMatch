import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { docHref, headingId } from "@/lib/docs";

function text(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(text).join("");
  if (children && typeof children === "object" && "props" in children)
    return text((children as { props: { children?: ReactNode } }).props.children);
  return "";
}

function heading(Tag: "h2" | "h3" | "h4") {
  return function Heading({ children }: { children?: ReactNode }) {
    const id = headingId(text(children));
    return (
      <Tag id={id} className="group scroll-mt-24">
        <a href={`#${id}`} className="!font-semibold !text-ink !no-underline">
          {children}
          <span className="ml-2 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
            #
          </span>
        </a>
      </Tag>
    );
  };
}

const components: Components = {
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  a({ href = "", children }) {
    const to = docHref(href);
    return to.startsWith("/") || to.startsWith("#") ? <Link href={to}>{children}</Link> : <a href={to}>{children}</a>;
  },
  table({ children }) {
    return (
      <div className="not-prose my-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3.5 [&_td]:py-2 [&_td]:align-top [&_th]:bg-surface-2 [&_th]:px-3.5 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-ink-2">
          {children}
        </table>
      </div>
    );
  },
};

/** Renders a doc's Markdown in the site's reading style. */
export function Markdown({ source }: { source: string }) {
  return (
    <div
      className="prose max-w-none prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:border-t prose-h2:border-line prose-h2:pt-8 prose-h2:text-xl prose-h3:mt-8 prose-h3:text-base prose-p:leading-relaxed prose-p:text-ink-2 prose-a:font-normal prose-a:text-accent prose-a:underline-offset-[3px] hover:prose-a:text-ink prose-strong:text-ink prose-code:rounded-md prose-code:bg-code prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:[overflow-wrap:anywhere] prose-code:text-ink prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-line prose-pre:bg-code prose-pre:text-[13px] prose-li:text-ink-2 prose-li:marker:text-ink-3 prose-hr:border-line [&_pre_code]:bg-transparent [&_pre_code]:p-0"
      style={{ ["--tw-prose-invert-body" as string]: "var(--text-2)", ["--tw-prose-invert-headings" as string]: "var(--text)" }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
