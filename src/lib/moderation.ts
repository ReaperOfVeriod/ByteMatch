import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auditLog, blockedAccounts, projects, sessions, users, type Project } from "../db/schema";
import { assertCanActOnAccount, assertCanActOnProject, type Role } from "./roles";

export interface Actor {
  id: number;
  login: string;
  role: Role;
}

/** Records an admin action. */
export async function audit(actor: Actor, action: string, target: string | null, detail?: Record<string, unknown>) {
  await db()
    .insert(auditLog)
    .values({ actorId: actor.id, actorLogin: actor.login, action, target, detail: detail ?? null });
}

export async function recentAudit(limit = 100) {
  return db().select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

/** Whether a GitHub account is blocked, by id or by login (logins are matched case-insensitively). */
export async function isBlocked(account: { githubId?: number | null; login: string }): Promise<boolean> {
  const byLogin = sql`lower(${blockedAccounts.login}) = lower(${account.login})`;
  const [row] = await db()
    .select({ id: blockedAccounts.id })
    .from(blockedAccounts)
    .where(account.githubId ? or(eq(blockedAccounts.githubId, account.githubId), byLogin) : byLogin)
    .limit(1);
  return !!row;
}

export async function listBlocked() {
  return db().select().from(blockedAccounts).orderBy(desc(blockedAccounts.createdAt));
}

/**
 * Blocks LOGIN: signs out any sessions, and with TAKE_DOWN disables every project the account
 * submitted. Returns how many projects were taken down.
 */
export async function block(actor: Actor, login: string, reason: string | null, takeDown: boolean): Promise<number> {
  const clean = login.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(clean)) throw new Error("That isn't a GitHub username.");
  const [user] = await db()
    .select()
    .from(users)
    .where(sql`lower(${users.login}) = lower(${clean})`);
  if (user && user.id === actor.id) throw new Error("You can't block yourself.");
  await assertCanActOnAccount(actor.role, { githubId: user?.githubId ?? null, login: clean });
  const [existing] = await db()
    .select({ id: blockedAccounts.id })
    .from(blockedAccounts)
    .where(sql`lower(${blockedAccounts.login}) = lower(${clean})`);
  if (existing) {
    await db()
      .update(blockedAccounts)
      .set({ reason, githubId: user?.githubId ?? null, blockedBy: actor.id })
      .where(eq(blockedAccounts.id, existing.id));
  } else {
    await db()
      .insert(blockedAccounts)
      .values({ login: user?.login ?? clean, githubId: user?.githubId ?? null, reason, blockedBy: actor.id });
  }
  let takenDown = 0;
  if (user) {
    await db().delete(sessions).where(eq(sessions.userId, user.id));
    if (takeDown) {
      const rows = await db()
        .update(projects)
        .set({ enabled: false, updatedAt: new Date() })
        .where(and(eq(projects.createdBy, user.id), eq(projects.enabled, true)))
        .returning({ id: projects.id });
      takenDown = rows.length;
    }
  }
  await audit(actor, "block", clean, { reason, takenDown });
  return takenDown;
}

export async function unblock(actor: Actor, id: number) {
  const [row] = await db().delete(blockedAccounts).where(eq(blockedAccounts.id, id)).returning();
  if (row) await audit(actor, "unblock", row.login);
}

/** Deletes a project and everything stored for it (reports, tokens, PR comment records). */
export async function deleteProject(actor: Actor, project: Project, reason: string | null) {
  await assertCanActOnProject(actor.role, project);
  await db().delete(projects).where(eq(projects.id, project.id));
  await audit(actor, "delete-project", `${project.owner}/${project.repo}`, { reason, name: project.name });
}

export async function setProjectsEnabled(actor: Actor, ids: number[], enabled: boolean) {
  if (!ids.length) return;
  for (const p of await db().select().from(projects).where(inArray(projects.id, ids))) await assertCanActOnProject(actor.role, p);
  const rows = await db().update(projects).set({ enabled, updatedAt: new Date() }).where(inArray(projects.id, ids)).returning();
  for (const p of rows) await audit(actor, enabled ? "enable-project" : "disable-project", `${p.owner}/${p.repo}`);
}

/** Removes a project's linked image and/or Discord invite (e.g. an obscene image). */
export async function clearProjectLinks(actor: Actor, project: Project, what: { image?: boolean; discord?: boolean }) {
  await assertCanActOnProject(actor.role, project);
  await db()
    .update(projects)
    .set({ ...(what.image ? { imageUrl: null } : {}), ...(what.discord ? { discordUrl: null } : {}), updatedAt: new Date() })
    .where(eq(projects.id, project.id));
  await audit(actor, "clear-links", `${project.owner}/${project.repo}`, {
    image: !!what.image,
    discord: !!what.discord,
    imageUrl: what.image ? project.imageUrl : undefined,
  });
}
