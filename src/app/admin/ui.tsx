"use client";

import { useActionState, useState } from "react";
import type { AdminState } from "./actions";

/** A destructive button that asks once more before it acts. */
export function ConfirmButton({
  action,
  fields,
  label,
  confirm,
  reason,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirm: string;
  /** Ask for a reason (kept in the audit log). */
  reason?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed)
    return (
      <button type="button" onClick={() => setArmed(true)} className="rounded-lg px-2 py-1 text-xs text-bad hover:bg-bad/10">
        {label}
      </button>
    );
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {reason ? <input name="reason" placeholder="Reason (logged)" className="field h-7 w-36 px-2 text-xs" autoFocus /> : null}
      <button className="rounded-lg bg-bad px-2 py-1 text-xs font-medium text-white">{confirm}</button>
      <button type="button" onClick={() => setArmed(false)} className="rounded-lg px-2 py-1 text-xs text-ink-3 hover:text-ink">
        Cancel
      </button>
    </form>
  );
}

/** A plain action button posted as a form, with its hidden fields. */
export function ActionButton({
  action,
  fields,
  label,
  tone = "ghost",
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  tone?: "ghost" | "plain";
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        className={
          tone === "ghost" ? "rounded-lg px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink" : "btn btn-ghost h-9 px-3 text-sm"
        }
      >
        {label}
      </button>
    </form>
  );
}

export function BlockForm({ action }: { action: (s: AdminState, f: FormData) => Promise<AdminState> }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-1.5 text-sm">
        GitHub username
        <input name="login" required placeholder="octocat" className="field" autoComplete="off" />
      </label>
      <label className="grid gap-1.5 text-sm">
        Reason <span className="text-xs text-ink-3">kept in the audit log</span>
        <input name="reason" placeholder="Obscene project image" className="field" />
      </label>
      <button disabled={pending} className="btn bg-bad text-white hover:bg-bad/90">
        {pending ? "Blocking…" : "Block"}
      </button>
      <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-3">
        <input type="checkbox" name="takeDown" defaultChecked className="size-4 accent-[var(--bad)]" /> Also take their submitted projects
        offline
      </label>
      {state.error ? (
        <p className="text-sm text-bad sm:col-span-3">{state.error}</p>
      ) : state.message ? (
        <p className="text-sm text-ink-2 sm:col-span-3">{state.message}</p>
      ) : null}
    </form>
  );
}
