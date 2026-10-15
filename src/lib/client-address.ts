/**
 * The visitor's address, as the reverse proxy in front of ByteMatch saw it, for rate limits.
 *
 * X-Real-IP comes first: the documented nginx setup sets it to $remote_addr, overwriting anything
 * the client sent. Failing that, the *last* X-Forwarded-For entry, which the nearest proxy appended;
 * the first entries are whatever the client claimed and can't be trusted. IPv6 addresses are cut
 * to their /64, since one connection can rotate through a whole /64.
 */
export function clientAddress(headers: { get(name: string): string | null }): string | null {
  const real = headers.get("x-real-ip")?.trim();
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .at(-1);
  const address = real || forwarded;
  if (!address) return null;
  if (address.includes(":") && !/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    const groups = address
      .replace(/^\[|\]$/g, "")
      .split("::")[0]
      .split(":");
    return `${groups.slice(0, 4).join(":")}::/64`;
  }
  return address;
}
