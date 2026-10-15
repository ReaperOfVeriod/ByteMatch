import { notFound } from "next/navigation";
import { currentSession } from "@/auth/session";
import { noindexMetadata } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";
export const metadata = noindexMetadata("Admin");

/** Site admins only; everyone else gets the ordinary 404, so the panel isn't advertised. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session?.role) notFound();
  const s = await getSettings();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs text-ink-2 capitalize">{session.role}</span>
        {s.syncPaused ? <span className="rounded-full bg-bad/15 px-2.5 py-0.5 text-xs font-medium text-bad">Syncing paused</span> : null}
      </div>
      <AdminNav owner={session.owner} />
      {children}
    </div>
  );
}
