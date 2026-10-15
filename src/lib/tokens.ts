import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { apiTokens, type Project } from "../db/schema";
import { newToken, sha256 } from "./crypto";

/** Creates an upload token for PROJECT; the plain value is returned once and never stored. */
export async function createToken(project: Project, name: string, userId: number | null): Promise<string> {
  const token = newToken("bm");
  await db()
    .insert(apiTokens)
    .values({ projectId: project.id, name, tokenHash: sha256(token), prefix: token.slice(0, 7), createdBy: userId });
  return token;
}

/** True when TOKEN is one of PROJECT's upload tokens (and marks it used). */
export async function checkToken(project: Project, token: string): Promise<boolean> {
  const [row] = await db()
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiTokens.projectId, project.id), eq(apiTokens.tokenHash, sha256(token))))
    .returning({ id: apiTokens.id });
  return !!row;
}

export async function listTokens(projectId: number) {
  return db().select().from(apiTokens).where(eq(apiTokens.projectId, projectId)).orderBy(apiTokens.createdAt);
}

export async function revokeToken(projectId: number, tokenId: number) {
  await db()
    .delete(apiTokens)
    .where(and(eq(apiTokens.projectId, projectId), eq(apiTokens.id, tokenId)));
}
