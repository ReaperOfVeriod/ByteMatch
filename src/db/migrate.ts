import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "./client";

/** Applies the SQL migrations in drizzle/. Run before starting a new version: npm run db:migrate. */
export async function runMigrations() {
  await migrate(db(), { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => console.log("migrations applied"))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
