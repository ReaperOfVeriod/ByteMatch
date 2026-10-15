import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProject, TEST_DB, useTestDb } from "../../test/db";
import { resetConfig } from "./config";

describe.skipIf(!TEST_DB)("roles", () => {
  useTestDb();
  const before = process.env.ADMIN_GITHUB_LOGINS;
  beforeAll(() => {
    process.env.ADMIN_GITHUB_LOGINS = "Boss";
    resetConfig();
  });
  afterAll(() => {
    process.env.ADMIN_GITHUB_LOGINS = before;
    resetConfig();
  });

  async function user(githubId: number, login: string) {
    const { db } = await import("../db/client");
    const { users } = await import("../db/schema");
    const [u] = await db().insert(users).values({ githubId, login }).returning();
    return u;
  }

  it("owners appoint admins; admins moderate everyone but owners, owners' projects and other admins", async () => {
    const { appointAdmin, removeAdmin, roleOf, listAdmins, Forbidden } = await import("./roles");
    const { block, deleteProject, setProjectsEnabled } = await import("./moderation");
    const boss = await user(1, "boss");
    const mod = await user(2, "mod");
    const other = await user(3, "othermod");
    const rando = await user(4, "rando");
    const owner = { id: boss.id, login: "boss", role: "owner" as const };
    const admin = { id: mod.id, login: "mod", role: "admin" as const };

    expect(await roleOf({ login: "BOSS" })).toBe("owner");
    expect(await roleOf({ login: "mod" })).toBeNull();
    await appointAdmin(owner, "mod");
    await appointAdmin(owner, "@othermod");
    expect(await roleOf({ githubId: 2, login: "renamed" })).toBe("admin");
    await expect(appointAdmin(admin, "rando")).rejects.toBeInstanceOf(Forbidden);
    await expect(appointAdmin(owner, "boss")).rejects.toThrow(/already an owner/);

    // Accounts.
    await expect(block(admin, "boss", null, false)).rejects.toThrow(/Owners/);
    await expect(block(owner, "boss", null, false)).rejects.toThrow(/yourself|Owners/);
    await expect(block(admin, "othermod", null, false)).rejects.toThrow(/owner can act on another admin/);
    await block(admin, "rando", "spam", false);

    // Projects.
    const ownersProject = await makeProject({ createdBy: boss.id });
    const randosProject = await makeProject({ owner: "r", repo: "x", name: "X", githubId: 9, createdBy: rando.id });
    await expect(deleteProject(admin, ownersProject, null)).rejects.toThrow(/belongs to an owner/);
    await expect(setProjectsEnabled(admin, [ownersProject.id], false)).rejects.toThrow(/belongs to an owner/);
    await deleteProject(admin, randosProject, "spam");
    await setProjectsEnabled(owner, [ownersProject.id], false);

    const removed = (await listAdmins()).find((a) => a.login === "othermod")!;
    await expect(removeAdmin(admin, removed.id)).rejects.toBeInstanceOf(Forbidden);
    await removeAdmin(owner, removed.id);
    expect(await roleOf({ login: "othermod" })).toBeNull();
    expect(other.id).toBeGreaterThan(0);
  });
});
