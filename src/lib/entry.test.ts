import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isEntry } from "./entry";

describe("isEntry", () => {
  const argv = process.argv[1];
  afterEach(() => {
    process.argv[1] = argv;
    delete process.env.pm_exec_path;
  });

  it("recognises a script run directly", () => {
    process.argv[1] = "/srv/app/dist/main.js";
    expect(isEntry(pathToFileURL("/srv/app/dist/main.js").href)).toBe(true);
    expect(isEntry(pathToFileURL("/srv/app/dist/migrate.js").href)).toBe(false);
  });

  it("recognises a script started by pm2's launcher", () => {
    process.argv[1] = "/srv/app/node_modules/pm2/lib/ProcessContainerFork.js";
    process.env.pm_exec_path = "/srv/app/dist/main.js";
    expect(isEntry(pathToFileURL("/srv/app/dist/main.js").href)).toBe(true);
  });
});
