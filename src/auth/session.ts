import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "../db/client";
import { sessions, users, type Project, type User } from "../db/schema";
import { userClient } from "../github/client";
import { config } from "../lib/config";
import { decrypt, encrypt, sha256 } from "../lib/crypto";

export const SESSION_COOKIE = "bytematch_session";
export const STATE_COOKIE = "bytematch_oauth_state";
const SESSION_DAYS = 30;

export interface Session {
  user: User;
  githubToken: string;
  admin: boolean;
}

const secureCookies = () => config().PUBLIC_URL.startsWith("https://");

export function cookieOptions(maxAgeSeconds: number) {
  return { httpOnly: true, secure: secureCookies(), sameSite: "lax" as const, path: "/", maxAge: maxAgeSeconds };
}

/** Creates a session for a GitHub user who just signed in; returns the cookie value. */
export async function createSession(
  profile: { id: number; login: string; name?: string | null; avatar_url?: string | null },
  githubToken: string,
) {
  const [user] = await db()
    .insert(users)
    .values({ githubId: profile.id, login: profile.login, name: profile.name ?? null, avatarUrl: profile.avatar_url ?? null })
    .onConflictDoUpdate({
      target: users.githubId,
      set: { login: profile.login, name: profile.name ?? null, avatarUrl: profile.avatar_url ?? null },
    })
    .returning();
  const token = randomBytes(32).toString("base64url");
  await db()
    .insert(sessions)
    .values({
      id: sha256(token),
      userId: user.id,
      githubToken: encrypt(githubToken),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
    });
  return { token, maxAge: SESSION_DAYS * 86400 };
}

/** The signed-in user for this request, if any (once per request). */
export const currentSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !config().SECRET_KEY) return null;
  const [row] = await db()
    .select({ user: users, githubToken: sessions.githubToken })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  try {
    return {
      user: row.user,
      githubToken: decrypt(row.githubToken),
      admin: config().ADMIN_GITHUB_LOGINS.includes(row.user.login.toLowerCase()),
    };
  } catch {
    return null;
  }
});

export async function destroySession(token: string | undefined) {
  if (token)
    await db()
      .delete(sessions)
      .where(eq(sessions.id, sha256(token)));
}

/** Can the session's user manage OWNER/REPO? Site admins can; otherwise GitHub must say "admin". */
export async function canManageRepo(session: Session, owner: string, repo: string): Promise<boolean> {
  if (session.admin) return true;
  try {
    const { data } = await userClient(session.githubToken).request("GET /repos/{owner}/{repo}", { owner, repo });
    return !!data.permissions?.admin;
  } catch {
    return false;
  }
}

export const canManage = (session: Session, project: Pick<Project, "owner" | "repo">) =>
  canManageRepo(session, project.owner, project.repo);
