/** A project's Discord invite: only discord.gg/<code> or discord.com/invite/<code>, normalised to https. */
export function checkDiscordUrl(input: string): { url: string | null } | { error: string } {
  const raw = input.trim();
  if (!raw) return { url: null };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { error: "Enter a Discord invite link, e.g. https://discord.gg/abc123." };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const code =
    host === "discord.gg"
      ? url.pathname.split("/")[1]
      : host === "discord.com" || host === "discordapp.com"
        ? url.pathname.match(/^\/invite\/([^/]+)/)?.[1]
        : undefined;
  if (!code || !/^[A-Za-z0-9-]{2,64}$/.test(code)) return { error: "Use a Discord invite link (discord.gg/… or discord.com/invite/…)." };
  return { url: `https://discord.gg/${code}` };
}
