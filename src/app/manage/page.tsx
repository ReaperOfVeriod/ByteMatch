import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/auth/session";
import { db } from "@/db/client";
import { projects } from "@/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage" };

export default async function Manage() {
  const session = await currentSession();
  if (!session) redirect("/auth/login?next=/manage");
  const list = await db()
    .select()
    .from(projects)
    .where(session.admin ? undefined : eq(projects.createdBy, session.user.id))
    .orderBy(desc(projects.updatedAt));
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Manage</h1>
        <Link href="/manage/new" className="ml-auto h-9 rounded-md bg-accent px-4 text-sm leading-9 font-medium text-white">
          Add project
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {session.admin
          ? "All projects (you are a site admin)."
          : "Projects you added. To manage another, add it: you need admin rights on its repository."}
      </p>
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/manage/${p.owner}/${p.repo}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-ink-3">
                {p.owner}/{p.repo}
              </span>
              {!p.enabled ? <span className="text-xs text-ink-3">disabled</span> : null}
              {p.lastError ? <span className="ml-auto text-xs text-bad">last ingest failed</span> : null}
            </Link>
          </li>
        ))}
        {list.length === 0 ? <li className="px-4 py-8 text-center text-sm text-ink-3">No projects yet.</li> : null}
      </ul>
    </div>
  );
}
