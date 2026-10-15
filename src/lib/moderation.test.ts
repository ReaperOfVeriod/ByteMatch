import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";

describe.skipIf(!TEST_DB)("moderation", () => {
  useTestDb();

  async function user(githubId: number, login: string) {
    const { db } = await import("../db/client");
    const { users } = await import("../db/schema");
    const [u] = await db().insert(users).values({ githubId, login }).returning();
    return u;
  }

  it("blocks by login before sign-in, signs out, takes projects down and logs it", async () => {
    const { block, isBlocked, recentAudit, unblock, listBlocked } = await import("./moderation");
    const { db } = await import("../db/client");
    const { projects, sessions } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const admin = await user(1, "admin");
    const actor = { id: admin.id, login: admin.login, role: "owner" as const };

    // Not signed in yet: matched by login.
    await block(actor, "@Spammer", "spam", true);
    expect(await isBlocked({ login: "spammer" })).toBe(true);
    expect(await isBlocked({ githubId: 99, login: "SPAMMER" })).toBe(true);
    expect(await isBlocked({ githubId: 5, login: "someone" })).toBe(false);

    // Signed in, with a session and projects.
    const troll = await user(2, "troll");
    await db()
      .insert(sessions)
      .values({ id: "s", userId: troll.id, githubToken: "x", expiresAt: new Date(Date.now() + 1e6) });
    const p = await makeProject({ createdBy: troll.id });
    expect(await block(actor, "troll", "obscene image", true)).toBe(1);
    expect(await isBlocked({ githubId: 2, login: "renamed-troll" })).toBe(true);
    expect(await db().select().from(sessions).where(eq(sessions.userId, troll.id))).toHaveLength(0);
    expect((await db().select().from(projects).where(eq(projects.id, p.id)))[0].enabled).toBe(false);

    await expect(block(actor, "admin", null, false)).rejects.toThrow(/yourself/);
    await expect(block(actor, "not a login!", null, false)).rejects.toThrow(/username/);

    const spam = (await listBlocked()).find((b) => b.login.toLowerCase() === "spammer")!;
    await unblock(actor, spam.id);
    expect(await isBlocked({ login: "spammer" })).toBe(false);
    expect((await recentAudit()).map((a) => a.action)).toEqual(["unblock", "block", "block"]);
  });

  it("deletes a project with everything stored for it", async () => {
    const { deleteProject, clearProjectLinks } = await import("./moderation");
    const { storeReport } = await import("../db/store");
    const { parseReport } = await import("../report/parse");
    const { db } = await import("../db/client");
    const { projects, reports } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const admin = await user(1, "admin");
    const actor = { id: admin.id, login: admin.login, role: "owner" as const };
    const p = await makeProject({ imageUrl: "https://example.com/bad.png", discordUrl: "https://discord.gg/x" });
    await storeReport({
      project: p,
      version: "v",
      commit: { sha: "a", timestamp: new Date() },
      report: parseReport(readFileSync(new URL("../../test/fixtures/report-v2.json", import.meta.url))),
      source: "upload",
    });

    await clearProjectLinks(actor, p, { image: true });
    const [after] = await db().select().from(projects).where(eq(projects.id, p.id));
    expect(after.imageUrl).toBeNull();
    expect(after.discordUrl).toBe("https://discord.gg/x");

    await deleteProject(actor, after, "obscene");
    expect(await db().select().from(projects).where(eq(projects.id, p.id))).toHaveLength(0);
    expect(await db().select().from(reports).where(eq(reports.projectId, p.id))).toHaveLength(0);
  });
});
