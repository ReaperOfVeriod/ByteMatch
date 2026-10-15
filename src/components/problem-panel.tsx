import Link from "next/link";
import type { ProjectProblem } from "@/lib/project-problems";
import { LocalTime } from "./local-time";

/** Inline code in an explanation: `like this`. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") ? (
          <code key={i} className="rounded bg-code px-1 py-0.5 font-mono text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * A sync problem explained for the project's maintainers: what happened, how to fix it, where it
 * happened, and the raw error tucked away for when they ask for help. Never shown to the public.
 */
export function ProblemPanel({
  problem,
  manageHref,
  children,
}: {
  problem: ProjectProblem;
  manageHref?: string;
  children?: React.ReactNode;
}) {
  const { explanation: e } = problem;
  const warning = problem.code === "rate-limited";
  return (
    <section
      className={`rounded-xl border px-5 py-4 text-sm ${warning ? "border-warn/40 bg-warn/5" : "border-bad/40 bg-bad/5"}`}
      aria-labelledby="problem-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="problem-title" className={`font-semibold ${warning ? "text-warn" : "text-bad"}`}>
          {e.title}
        </h2>
        {manageHref ? <span className="text-xs text-ink-3">Only maintainers see this</span> : null}
      </div>
      <p className="mt-1.5 text-ink-2">
        <Prose text={e.what} />
        {problem.at ? (
          <span className="text-ink-3">
            {" "}
            (<LocalTime value={problem.at} />)
          </span>
        ) : null}
      </p>
      {e.fix.length ? (
        <>
          <h3 className="mt-3 font-medium">How to fix it</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-2">
            {e.fix.map((step) => (
              <li key={step}>
                <Prose text={step} />
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {problem.runUrl ? (
          <a href={problem.runUrl} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
            Open the CI run on GitHub ↗
          </a>
        ) : null}
        {e.docs ? (
          <Link href={e.docs.href} className="text-accent hover:underline">
            {e.docs.label}
          </Link>
        ) : null}
        {manageHref ? (
          <Link href={manageHref} className="text-accent hover:underline">
            Manage this project
          </Link>
        ) : null}
        {children}
      </div>
      <details className="mt-3 text-xs text-ink-3">
        <summary className="cursor-pointer select-none hover:text-ink">Technical details</summary>
        <p className="mt-1.5 font-mono break-words">{problem.technical}</p>
      </details>
    </section>
  );
}
