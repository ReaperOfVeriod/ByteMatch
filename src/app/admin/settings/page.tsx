import { config } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { setRegistration, setSyncPaused } from "../actions";

export default async function AdminSettings() {
  const s = await getSettings();
  const env = config().OPEN_REGISTRATION ? "open" : "closed";
  const option = (value: string, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
      <input
        type="radio"
        name="registration"
        value={value}
        defaultChecked={(s.registration ?? "env") === value}
        className="mt-1 accent-[var(--accent-strong)]"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel p-5">
        <h2 className="mb-1 text-sm font-semibold">Submitting projects</h2>
        <p className="mb-4 text-sm text-ink-2">Who may add projects. Site admins always can.</p>
        <form action={setRegistration} className="grid gap-2">
          {option("env", `Follow the server setting (currently ${env})`, "OPEN_REGISTRATION in .env")}
          {option("open", "Open", "Anyone signed in may submit repositories they administer")}
          {option("closed", "Closed", "Only site admins may add projects")}
          <button className="btn btn-primary mt-2 justify-self-start">Save</button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="mb-1 text-sm font-semibold">Syncing</h2>
        <p className="mb-4 text-sm text-ink-2">
          Pausing holds back every sync (polls, CI ingests, imports, PR comments) for maintenance or while GitHub is having problems. Queued
          work waits and resumes when you switch it back on; pages and badges keep working.
        </p>
        <p className="mb-4 text-sm">
          Syncing is <strong className={s.syncPaused ? "text-bad" : "text-good"}>{s.syncPaused ? "paused" : "running"}</strong>.
        </p>
        <form action={setSyncPaused}>
          <input type="hidden" name="paused" value={String(!s.syncPaused)} />
          <button className={s.syncPaused ? "btn btn-primary" : "btn bg-bad text-white hover:bg-bad/90"}>
            {s.syncPaused ? "Resume syncing" : "Pause syncing"}
          </button>
        </form>
      </section>
    </div>
  );
}
