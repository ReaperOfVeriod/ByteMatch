import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { settings } from "../db/schema";
import { config } from "./config";

/** Instance switches the admin panel can flip without editing .env, plus the worker's heartbeat. */
export interface Settings {
  /** null follows OPEN_REGISTRATION from the environment. */
  registration: "open" | "closed" | null;
  /** Pauses all syncing (polls, ingests, imports, PR comments); queued jobs wait. */
  syncPaused: boolean;
  /** ISO time of the worker's last heartbeat. */
  workerHeartbeat: string | null;
}

const DEFAULTS: Settings = { registration: null, syncPaused: false, workerHeartbeat: null };
const KEYS: Record<keyof Settings, string> = {
  registration: "registration",
  syncPaused: "sync_paused",
  workerHeartbeat: "worker_heartbeat",
};

export async function getSettings(): Promise<Settings> {
  const rows = await db().select().from(settings);
  const out = { ...DEFAULTS };
  for (const [k, key] of Object.entries(KEYS) as [keyof Settings, string][]) {
    const row = rows.find((r) => r.key === key);
    if (row) (out as Record<string, unknown>)[k] = row.value;
  }
  return out;
}

export async function setSetting<K extends keyof Settings>(k: K, value: Settings[K]): Promise<void> {
  await db()
    .insert(settings)
    .values({ key: KEYS[k], value: value as unknown, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as unknown, updatedAt: sql`now()` } });
}

export async function clearSetting(k: keyof Settings): Promise<void> {
  await db().delete(settings).where(eq(settings.key, KEYS[k]));
}

/** Whether signed-in users (not only admins) may add projects right now. */
export async function registrationOpen(): Promise<boolean> {
  const s = await getSettings();
  return s.registration === null ? config().OPEN_REGISTRATION : s.registration === "open";
}

export async function syncPaused(): Promise<boolean> {
  return (await getSettings()).syncPaused;
}
