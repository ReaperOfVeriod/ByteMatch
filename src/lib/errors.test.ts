import { describe, expect, it } from "vitest";
import { publicError, redact } from "./errors";

describe("error text", () => {
  it("removes tokens, account ids and signed URLs", () => {
    const msg =
      "API rate limit exceeded for user ID 9876543. token ghp_abcdefghijklmnopqrstuvwxyz0123456789 and github_pat_11ABCDEFG0123456789_abcdefghijklmnop " +
      "at https://user:secret@api.github.com/x?access_token=abc123 via https://productionresultssa1.blob.core.windows.net/actions-results/abc?sig=xyz";
    const out = redact(msg);
    expect(out).not.toMatch(/9876543|ghp_|github_pat_|secret|abc123|blob\.core|sig=xyz/);
    expect(out).toContain("[id]");
    expect(out).toContain("[token]");
  });

  it("gives public pages a category only", () => {
    expect(publicError("API rate limit exceeded for user ID 1")).toMatch(/limiting requests/);
    expect(publicError("no GitHub access to a/b: install the GitHub App there or set GITHUB_TOKEN")).toMatch(
      /install the ByteMatch GitHub App/,
    );
    expect(publicError("report is not valid JSON")).toMatch(/couldn't be read/);
    expect(publicError(null)).toBeNull();
    expect(publicError("weird failure 9876543")).not.toMatch(/9876543/);
  });
});
