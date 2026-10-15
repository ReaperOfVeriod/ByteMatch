import { and, eq } from "drizzle-orm";
import { gameKey, resolveKey, type Aliases } from "../lib/games";
import { db } from "./client";
import { nameAliases } from "./schema";

export type AliasKind = "game" | "franchise";

export interface AliasSet {
  games: Aliases;
  franchises: Aliases;
  rows: (typeof nameAliases.$inferSelect)[];
}

export async function loadAliases(): Promise<AliasSet> {
  const rows = await db().select().from(nameAliases).orderBy(nameAliases.createdAt);
  const map = (kind: AliasKind) => new Map(rows.filter((r) => r.kind === kind).map((r) => [r.fromKey, r.toKey]));
  return { games: map("game"), franchises: map("franchise"), rows };
}

export class AliasError extends Error {}

/** Makes FROM group with TO from now on. Refuses a merge into itself or one that would loop. */
export async function addAlias(kind: AliasKind, fromName: string, toName: string, createdBy: number | null) {
  const aliases = await loadAliases();
  const map = kind === "game" ? aliases.games : aliases.franchises;
  const fromKey = gameKey(fromName);
  const toKey = resolveKey(toName, map);
  if (!fromKey || !toKey) throw new AliasError("Both names are needed.");
  if (fromKey === toKey) throw new AliasError("Those names already group together.");
  if (resolveKey(toName, new Map([...map, [fromKey, toKey]])) !== toKey) throw new AliasError("That merge would go round in a circle.");
  await db()
    .insert(nameAliases)
    .values({ kind, fromKey, fromName, toKey, toName, createdBy })
    .onConflictDoUpdate({
      target: [nameAliases.kind, nameAliases.fromKey],
      set: { fromName, toKey, toName, createdBy, createdAt: new Date() },
    });
  // Names already merged into FROM now follow it to TO.
  await db()
    .update(nameAliases)
    .set({ toKey, toName })
    .where(and(eq(nameAliases.kind, kind), eq(nameAliases.toKey, fromKey)));
}

export async function removeAlias(kind: AliasKind, fromKey: string): Promise<boolean> {
  const rows = await db()
    .delete(nameAliases)
    .where(and(eq(nameAliases.kind, kind), eq(nameAliases.fromKey, fromKey)))
    .returning({ k: nameAliases.fromKey });
  return rows.length > 0;
}
