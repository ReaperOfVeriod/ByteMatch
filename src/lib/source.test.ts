import { describe, expect, it } from "vitest";
import { cleanSourcePath, findFunction, highlightLine, maskNonCode } from "./source";

const file = `#include "common.h"

extern long func_00116F68(int arg0, int arg1, int arg2);

/* atoi, from newlib.
   Calls strtol. */
int func_00112380(int arg0) {
    return (int)func_00116F68(arg0, 0, 10); /* func_00112380( in a comment { */
}

// helper
static void
func_00112400(char *s)
{
    const char *x = "func_00112400(";
    if (s) { *s = '}'; }
}

INCLUDE_ASM("asm/nonmatchings/core/00112380", func_00112468);
LINKER_REMNANT("asm/remnants/core_text", func_00112470);

int func_0011B4C8_r(int a) __asm__("func_0011B4C8");
int func_0011B4C8_r(int a) {
    return a;
}

class Player {
  public:
    void Update(float dt) const { tick(dt); }
};
`;
const lines = file.split("\n");
const show = (r: ReturnType<typeof findFunction>) => (r ? lines.slice(r.start - 1, r.end).join("\n") : null);

describe("findFunction", () => {
  it("finds a definition with its comment, skipping declarations, calls and comments", () => {
    const r = findFunction(file, "func_00112380");
    expect(r?.kind).toBe("c");
    expect(show(r)).toMatch(/^\/\* atoi, from newlib\.[\s\S]*int func_00112380\(int arg0\) \{[\s\S]*\n\}$/);
  });

  it("finds a definition whose return type is on the line before, and isn't fooled by braces in literals", () => {
    const r = findFunction(file, "func_00112400");
    expect(show(r)).toBe(`// helper
static void
func_00112400(char *s)
{
    const char *x = "func_00112400(";
    if (s) { *s = '}'; }
}`);
  });

  it("points at the assembly a function still is", () => {
    expect(findFunction(file, "func_00112468")).toEqual({ kind: "asm", start: 19, end: 19 });
    expect(findFunction(file, "func_00112470")).toEqual({ kind: "asm", start: 20, end: 20 });
  });

  it("follows an asm label to the C name it was written under", () => {
    expect(show(findFunction(file, "func_0011B4C8"))).toBe("int func_0011B4C8_r(int a) {\n    return a;\n}");
  });

  it("finds C++ methods by their qualified or plain name", () => {
    expect(show(findFunction(file, "Player::Update"))).toContain("void Update(float dt) const { tick(dt); }");
  });

  it("says when it can't find a function", () => {
    expect(findFunction(file, "func_00116F68")).toBeNull(); // only declared and called
    expect(findFunction(file, "nope")).toBeNull();
  });

  it("masks comments and strings but keeps line breaks", () => {
    const m = maskNonCode('a /* {\n} */ "}" b');
    expect(m.split("\n")).toHaveLength(2);
    expect(m).not.toMatch(/[{}"]/);
  });
});

describe("cleanSourcePath", () => {
  it("allows plain relative paths only", () => {
    expect(cleanSourcePath("src/core/00112380.c")).toBe("src/core/00112380.c");
    expect(cleanSourcePath("./src\\game\\a.cpp")).toBe("src/game/a.cpp");
    for (const bad of ["/etc/passwd", "../secrets", "src/../../x", "C:/x.c", "", null]) expect(cleanSourcePath(bad)).toBeNull();
  });
});

describe("highlightLine", () => {
  it("splits a line into tokens and carries block comments over", () => {
    expect(highlightLine('int x = 0x10; // "hi"', false).tokens).toEqual([
      ["type", "int"],
      ["plain", " x = "],
      ["number", "0x10"],
      ["plain", "; "],
      ["comment", '// "hi"'],
    ]);
    const a = highlightLine("return 1; /* starts", false);
    expect(a.inComment).toBe(true);
    expect(highlightLine("ends */ x", true).tokens[0]).toEqual(["comment", "ends */"]);
    expect(highlightLine('#include "a.h"', false).tokens).toEqual([["preproc", '#include "a.h"']]);
  });
});

describe("candidates", () => {
  it("tries the file starting nearest below the function's address first", async () => {
    const { candidates } = await import("./source-fetch");
    const files = ["d/vendor_002CF2C0.c", "d/help_00204AC0.c", "d/misc.c", "d/zz_0032C000.c", "d/func_L05_0032BBF0.c"];
    expect(candidates(files, "func_L05_0032BBF0")[0]).toBe("d/func_L05_0032BBF0.c");
    expect(candidates(files.slice(0, 4), "func_L05_0032BBF0")).toEqual([
      "d/vendor_002CF2C0.c",
      "d/help_00204AC0.c",
      "d/misc.c",
      "d/zz_0032C000.c",
    ]);
  });
});
