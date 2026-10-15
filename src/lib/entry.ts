import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** True when the module at URL is the script Node was started with (directly, via pm2 or tsx). */
export function isEntry(url: string): boolean {
  const script = process.argv[1];
  return !!script && pathToFileURL(resolve(script)).href === url;
}
