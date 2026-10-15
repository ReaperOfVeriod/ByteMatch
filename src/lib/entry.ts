import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * True when the module at URL is the script being run: started directly (node, tsx), or by pm2,
 * whose launcher imports the script and passes its path in pm_exec_path instead of argv[1].
 */
export function isEntry(url: string): boolean {
  const scripts = [process.argv[1], process.env.pm_exec_path].filter((s): s is string => !!s);
  return scripts.some((s) => pathToFileURL(resolve(s)).href === url);
}
