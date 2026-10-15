import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../lib/config";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __bytematchSql?: postgres.Sql; __bytematchDb?: Db };

/** One pool per process (kept across Next.js dev reloads). */
export function sql(): postgres.Sql {
  return (g.__bytematchSql ??= postgres(config().DATABASE_URL, { max: 10, onnotice: () => {} }));
}

export function db(): Db {
  return (g.__bytematchDb ??= drizzle(sql(), { schema }));
}

export async function closeDb() {
  await g.__bytematchSql?.end({ timeout: 5 });
  g.__bytematchSql = undefined;
  g.__bytematchDb = undefined;
}
