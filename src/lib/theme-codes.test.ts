import { describe, expect, it } from "vitest";
import { CODE_PATTERN } from "./theme";
import { newThemeCode } from "./theme-codes";

describe("newThemeCode", () => {
  it("makes codes the parser accepts", () => {
    for (let i = 0; i < 500; i++) expect(newThemeCode()).toMatch(CODE_PATTERN);
  });
});
