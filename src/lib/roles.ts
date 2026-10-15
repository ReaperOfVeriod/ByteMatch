import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { siteAdmins, users, type Project } from "../db/schema";
import { config } from "./config";

/**
 * Two levels of site staff:
 * - owners: ADMIN_GITHUB_LOGINS in the server's configuration; full control, and the only ones who
 *   can appoint admins or change instance settings. Nothing in the panel can remove an owner.
 * - admins: appointed by an owner in the panel; they moderate, but cannot act on owners, owners'
 *   projects or other admins.
 */
export type Role = "owner" | "admin";

export class Forbidden extends Error {}

export function isOwnerLogin(login: string | null | undefined): boolean {
  return !!login && config().ADMIN_GITHUB_LOGINS.includes(login.toLowerCase());
}

export async function roleOf(account: { githubId?: number | null; login: string }): Promise<Role | null> {
  if (isOwnerLogin(account.login)) return "owner";
  const byLogin = sql`lower(${siteAdmins.login}) = lower(${account.login})`;
  const [row] = await db()
    .select({ id: siteAdmins.id })
    .from(siteAdmins)
    .where(account.githubId ? or(eq(siteAdmins.githubId, account.githubId), byLogin) : byLogin)
    .limit(1);
  return row ? "admin" : null;
}

/** The role of a project's submitter (null for ordinary users or unknown submitters). */
export async function submitterRole(project: Pick<Project, "createdBy">): Promise<Role | null> {
  if (!project.createdBy) return null;
  const [u] = await db().select({ login: users.login, githubId: users.githubId }).from(users).where(eq(users.id, project.createdBy));
  return u ? roleOf(u) : null;
}

/** Owners may act on anyone but other owners; admins only on ordinary accounts. */
export async function assertCanActOnAccount(actorRole: Role, target: { githubId?: number | null; login: string }) {
  const targetRole = await roleOf(target);
  if (targetRole === "owner") throw new Forbidden("Owners can't be blocked or changed from the panel.");
  if (targetRole === "admin" && actorRole !== "owner") throw new Forbidden("Only an owner can act on another admin.");
}

/** Projects submitted by an owner are off limits to admins. */
export async function assertCanActOnProject(actorRole: Role, project: Pick<Project, "createdBy">) {
  if (actorRole === "owner") return;
  if ((await submitterRole(project)) === "owner") throw new Forbidden("This project belongs to an owner.");
}

export async function listAdmins() {
  return db().select().from(siteAdmins).orderBy(desc(siteAdmins.createdAt));
}

export async function appointAdmin(actor: { id: number; role: Role }, login: string) {
  if (actor.role !== "owner") throw new Forbidden("Only owners can appoint admins.");
  const clean = login.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(clean)) throw new Error("That isn't a GitHub username.");
  if (isOwnerLogin(clean)) throw new Error("That account is already an owner.");
  const [u] = await db()
    .select()
    .from(users)
    .where(sql`lower(${users.login}) = lower(${clean})`);
  const [existing] = await db()
    .select({ id: siteAdmins.id })
    .from(siteAdmins)
    .where(sql`lower(${siteAdmins.login}) = lower(${clean})`);
  if (existing) return;
  await db()
    .insert(siteAdmins)
    .values({ login: u?.login ?? clean, githubId: u?.githubId ?? null, appointedBy: actor.id });
}

export async function removeAdmin(actor: { role: Role }, id: number) {
  if (actor.role !== "owner") throw new Forbidden("Only owners can remove admins.");
  const [row] = await db().delete(siteAdmins).where(eq(siteAdmins.id, id)).returning();
  return row;
}
