import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { isEntry } from "../lib/entry";
import { closeDb, db } from "./client";

/** Applies the SQL migrations in drizzle/. Run before starting a new version: npm run db:migrate. */
export async function runMigrations() {
  // drizzle/ sits in the project root, which is the working directory under pm2, Compose and tests.
  await migrate(db(), { migrationsFolder: process.env.MIGRATIONS_DIR ?? join(process.cwd(), "drizzle") });
}

if (isEntry(import.meta.url)) {
  runMigrations()
    .then(() => console.log("migrations applied"))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
