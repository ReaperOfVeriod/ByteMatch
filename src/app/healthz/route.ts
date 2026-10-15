import { sql } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql()`select 1`;
    return new Response("ok\n", { headers: { "cache-control": "no-store" } });
  } catch {
    return new Response("database unavailable\n", { status: 503, headers: { "cache-control": "no-store" } });
  }
}
