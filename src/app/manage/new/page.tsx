import { redirect } from "next/navigation";
import { currentSession } from "@/auth/session";
import { config } from "@/lib/config";
import { PLATFORMS } from "@/lib/platforms";
import { addProject } from "../actions";
import { ActionForm, inputClass } from "../forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add project" };

export default async function NewProject() {
  const session = await currentSession();
  if (!session) redirect("/auth/login?next=/manage/new");
  const closed = !config().OPEN_REGISTRATION && !session.admin;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Add project</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        A public GitHub repository you administer, whose CI uploads objdiff&apos;s report as a{" "}
        <code className="font-mono text-xs">{"<VERSION>_report"}</code> artifact.
      </p>
      {closed ? (
        <p className="text-sm text-ink-2">Only site admins can add projects on this instance.</p>
      ) : (
        <ActionForm action={addProject} submit="Add project">
          <label className="grid gap-1 text-sm">
            Repository
            <input name="repo" required placeholder="owner/repo or https://github.com/owner/repo" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            Display name <span className="text-xs text-ink-3">optional, e.g. &quot;Ratchet &amp; Clank (PAL)&quot;</span>
            <input name="name" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            Platform
            <select name="platform" className={inputClass} defaultValue="">
              <option value="">—</option>
              {Object.entries(PLATFORMS)
                .filter(([id]) => id !== "ps1")
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </select>
          </label>
        </ActionForm>
      )}
    </div>
  );
}
