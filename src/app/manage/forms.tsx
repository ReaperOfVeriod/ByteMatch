"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export const inputClass = "h-9 w-full rounded-md border border-line bg-bg px-3 text-sm";

function Result({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-bad">{state.error}</p>;
  if (state.message) return <p className="text-sm text-ink-2">{state.message}</p>;
  return null;
}

/** A form bound to a server action, with its result shown under it. */
export function ActionForm({
  action,
  children,
  submit,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  submit: string;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className={className ?? "grid gap-3"}>
      {children}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Working…" : submit}
        </button>
        <Result state={state} />
      </div>
      {state.token ? (
        <code className="block rounded-md border border-line bg-code px-3 py-2 font-mono text-sm break-all">{state.token}</code>
      ) : null}
    </form>
  );
}

/** One-click actions (poll, backfill, import) that share a result line. */
export function ActionButtons({ action, buttons }: { action: Action; buttons: { value: string; label: string; hint: string }[] }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.value}
            name="action"
            value={b.value}
            disabled={pending}
            title={b.hint}
            className="h-9 rounded-md border border-line px-3 text-sm text-ink-2 hover:text-ink disabled:opacity-60"
          >
            {b.label}
          </button>
        ))}
      </div>
      <Result state={state} />
    </form>
  );
}
