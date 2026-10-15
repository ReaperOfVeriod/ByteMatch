import { describe, expect, it } from "vitest";
import { checkImageUrl } from "./images";

describe("checkImageUrl", () => {
  it("accepts https links and clears on empty", () => {
    expect(checkImageUrl(" https://example.com/banner.png ")).toEqual({ url: "https://example.com/banner.png" });
    expect(checkImageUrl("")).toEqual({ url: null });
  });

  it("refuses anything else", () => {
    expect(checkImageUrl("http://example.com/a.png")).toHaveProperty("error");
    expect(checkImageUrl("javascript:alert(1)")).toHaveProperty("error");
    expect(checkImageUrl("data:image/png;base64,AAAA")).toHaveProperty("error");
    expect(checkImageUrl("https://user:pass@example.com/a.png")).toHaveProperty("error");
    expect(checkImageUrl("not a url")).toHaveProperty("error");
    expect(checkImageUrl(`https://example.com/${"a".repeat(3000)}`)).toHaveProperty("error");
  });
});
