import { describe, expect, it } from "vitest";
import { parseStyle, renderBadge, resolveColor, shieldsEndpoint, textWidth } from "./badge";
import { badgePng } from "./png";

describe("badges", () => {
  it("accepts every style spelling decomp.dev did", () => {
    expect(parseStyle("FlatSquare")).toBe("flat-square");
    expect(parseStyle("flat-square")).toBe("flat-square");
    expect(parseStyle("ForTheBadge")).toBe("for-the-badge");
    expect(parseStyle("Social")).toBe("flat");
    expect(parseStyle(null)).toBe("flat");
    expect(parseStyle("wavy")).toBeUndefined();
  });

  it("resolves named and hex colours", () => {
    expect(resolveColor("informational", "#000")).toBe("#007ec6");
    expect(resolveColor("ff0000", "#000")).toBe("#ff0000");
    expect(resolveColor("#abc", "#000")).toBe("#abc");
    expect(resolveColor("javascript:alert(1)", "#000")).toBe("#000");
  });

  it("sizes the badge to its text and escapes it", () => {
    const svg = renderBadge({ label: "Code <&>", message: "86.02%" });
    expect(svg).toContain("Code &lt;&amp;&gt;: 86.02%");
    const width = Number(/width="(\d+)"/.exec(svg)![1]);
    expect(width).toBe(Math.round(textWidth("Code <&>", 11)) + 10 + Math.round(textWidth("86.02%", 11)) + 10);
    expect(textWidth("WWW", 11)).toBeGreaterThan(textWidth("iii", 11));
  });

  it("renders PNG", () => {
    const png = badgePng(renderBadge({ label: "Functions", message: "4,520 / 5,109", style: "for-the-badge" }));
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("writes the shields endpoint format", () => {
    expect(shieldsEndpoint({ label: "Code", message: "1.00%" })).toEqual({
      schemaVersion: 1,
      label: "Code",
      message: "1.00%",
      color: "informational",
    });
  });
});
