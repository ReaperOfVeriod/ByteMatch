import { describe, expect, it } from "vitest";
import { clientAddress } from "./client-address";

const h = (values: Record<string, string>) => ({ get: (k: string) => values[k] ?? null });

describe("clientAddress", () => {
  it("trusts X-Real-IP, which the proxy overwrites", () => {
    expect(clientAddress(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("takes the last X-Forwarded-For entry, not the client-supplied first one", () => {
    expect(clientAddress(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("groups an IPv6 address by its /64", () => {
    expect(clientAddress(h({ "x-real-ip": "2001:db8:aa:bb:1:2:3:4" }))).toBe("2001:db8:aa:bb::/64");
    expect(clientAddress(h({ "x-real-ip": "2001:db8:aa:bb::9" }))).toBe("2001:db8:aa:bb::/64");
  });

  it("is null without either header", () => {
    expect(clientAddress(h({}))).toBeNull();
  });
});
