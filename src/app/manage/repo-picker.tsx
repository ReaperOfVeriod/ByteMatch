"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Search } from "@/components/ui/icons";
import type { FormState } from "./actions";

export interface PickableRepo {
  fullName: string;
  description: string | null;
  pushedAt: string | null;
  registered: string | null;
}

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function RepoPicker({ repos, action }: { repos: PickableRepo[]; action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [query, setQuery] = useState("");
  const [state, run, pending] = useActionState(action, {});
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => `${r.fullName} ${r.description ?? ""}`.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  return (
    <div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your repositories"
          aria-label="Search your repositories"
          className="field pl-10"
        />
      </div>
      {state.error ? <p className="mt-3 text-sm text-bad">{state.error}</p> : null}
      <form action={run}>
        <ul className="mt-3 max-h-[28rem] divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {shown.map((r) => (
            <li key={r.fullName} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.fullName}</div>
                <div className="truncate text-xs text-ink-3">
                  {r.description ?? "No description"}
                  {r.pushedAt ? ` · pushed ${fmtDate.format(new Date(r.pushedAt))}` : ""}
                </div>
              </div>
              {r.registered ? (
                <a href={`/manage/${r.registered}`} className="ml-auto shrink-0 text-xs text-ink-3 hover:text-ink">
                  Already added
                </a>
              ) : (
                <button name="repo" value={r.fullName} disabled={pending} className="btn btn-ghost ml-auto h-8 shrink-0 px-3 text-xs">
                  <Plus size={13} />
                  Add
                </button>
              )}
            </li>
          ))}
          {shown.length === 0 ? <li className="px-4 py-8 text-center text-sm text-ink-3">No repositories match.</li> : null}
        </ul>
      </form>
    </div>
  );
}
