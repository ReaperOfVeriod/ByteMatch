"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { currentSession } from "@/auth/session";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { audit, block, clearProjectLinks, deleteProject, setProjectsEnabled, unblock, type Actor } from "@/lib/moderation";
import { boss, enqueue, JOBS, type JobName } from "@/lib/queue";
import { clearSetting, setSetting } from "@/lib/settings";

export interface AdminState {
  error?: string;
  message?: string;
}

/** Every admin action re-checks the session: a 404 for anyone who is not a site admin. */
async function requireAdmin(): Promise<Actor> {
  const session = await currentSession();
  if (!session?.admin) notFound();
  return { id: session.user.id, login: session.user.login };
}

async function projectById(id: number) {
  const [p] = await db().select().from(projects).where(eq(projects.id, id));
  return p;
}

const done = (message: string): AdminState => {
  revalidatePath("/admin", "layout");
  return { message };
};

// ---- Projects ----

export async function resyncProject(form: FormData) {
  const actor = await requireAdmin();
  const p = await projectById(Number(form.get("id")));
  if (!p) return;
  await enqueue(JOBS.importDecompDev, { projectId: p.id }, `import:${p.id}`);
  await enqueue(JOBS.backfill, { projectId: p.id, maxRuns: 500 }, `backfill:${p.id}`);
  await audit(actor, "resync-project", `${p.owner}/${p.repo}`);
  revalidatePath("/admin/projects");
}

export async function toggleProject(form: FormData) {
  const actor = await requireAdmin();
  await setProjectsEnabled(actor, [Number(form.get("id"))], form.get("enabled") === "true");
  revalidatePath("/admin/projects");
}

export async function clearImage(form: FormData) {
  const actor = await requireAdmin();
  const p = await projectById(Number(form.get("id")));
  if (p) await clearProjectLinks(actor, p, { image: true });
  revalidatePath("/admin/projects");
}

export async function clearDiscord(form: FormData) {
  const actor = await requireAdmin();
  const p = await projectById(Number(form.get("id")));
  if (p) await clearProjectLinks(actor, p, { discord: true });
  revalidatePath("/admin/projects");
}

export async function removeProject(form: FormData) {
  const actor = await requireAdmin();
  const p = await projectById(Number(form.get("id")));
  if (p) await deleteProject(actor, p, String(form.get("reason") ?? "").trim() || null);
  revalidatePath("/admin/projects");
  revalidatePath("/");
}

// ---- Users ----

export async function blockAccount(_: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireAdmin();
  try {
    const takenDown = await block(
      actor,
      String(form.get("login") ?? ""),
      String(form.get("reason") ?? "").trim() || null,
      form.get("takeDown") === "on",
    );
    return done(`Blocked.${takenDown ? ` ${takenDown} project${takenDown === 1 ? "" : "s"} taken offline.` : ""}`);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function unblockAccount(form: FormData) {
  const actor = await requireAdmin();
  await unblock(actor, Number(form.get("id")));
  revalidatePath("/admin/users");
}

// ---- Jobs ----

export async function retryJob(form: FormData) {
  const actor = await requireAdmin();
  const name = String(form.get("name")) as JobName;
  const id = String(form.get("id"));
  await (await boss()).retry(name, id);
  await audit(actor, "retry-job", name, { id });
  revalidatePath("/admin/jobs");
}

export async function discardJob(form: FormData) {
  const actor = await requireAdmin();
  const name = String(form.get("name")) as JobName;
  const id = String(form.get("id"));
  await (await boss()).deleteJob(name, id);
  await audit(actor, "discard-job", name, { id });
  revalidatePath("/admin/jobs");
}

// ---- Settings ----

export async function setRegistration(form: FormData) {
  const actor = await requireAdmin();
  const v = String(form.get("registration"));
  if (v === "open" || v === "closed") await setSetting("registration", v);
  else await clearSetting("registration");
  await audit(actor, "set-registration", v);
  revalidatePath("/admin", "layout");
}

export async function setSyncPaused(form: FormData) {
  const actor = await requireAdmin();
  const paused = form.get("paused") === "true";
  await setSetting("syncPaused", paused);
  await audit(actor, paused ? "pause-sync" : "resume-sync", null);
  revalidatePath("/admin", "layout");
}
