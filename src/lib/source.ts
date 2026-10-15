/**
 * Finding one function in a source file, for showing a unit's code on its project page. Reports
 * say which file a unit comes from (objdiff's source_path) but not where in it a function is, so
 * this reads C and C++ just well enough to find a definition by name and where its body ends.
 */

export type FoundFunction =
  | { kind: "c"; start: number; end: number }
  /** Still assembly: the line that includes it (INCLUDE_ASM, GLOBAL_ASM, LINKER_REMNANT, #pragma GLOBAL_ASM…). */
  | { kind: "asm"; start: number; end: number };

/** Masks comments and string/char literals with spaces (keeping newlines), so braces and names inside them don't count. */
export function maskNonCode(text: string): string {
  const out: string[] = [];
  const blank = (ch: string) => (ch === "\n" ? "\n" : " ");
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") {
        out.push(" ");
        i++;
      }
    } else if (c === "/" && n === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      for (; i < stop; i++) out.push(blank(text[i]));
    } else if (c === '"' || c === "'") {
      out.push(" ");
      i++;
      while (i < text.length && text[i] !== c && text[i] !== "\n") {
        const step = text[i] === "\\" ? 2 : 1;
        for (let k = 0; k < step && i < text.length; k++, i++) out.push(blank(text[i]));
      }
      if (i < text.length) {
        out.push(blank(text[i]));
        i++;
      }
    } else {
      out.push(c);
      i++;
    }
  }
  return out.join("");
}

const lineOf = (text: string, index: number) => {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where NAME is defined in TEXT (1-based, inclusive lines), with the comment block directly above
 * it; or the line that includes it as assembly; or null. For C++ pass the unqualified name
 * ("Update" for "Player::Update") or the qualified one; both are tried.
 */
export function findFunction(text: string, name: string): FoundFunction | null {
  const masked = maskNonCode(text);
  const names = [...new Set([name, name.split("::").pop()!].filter(Boolean))];
  for (const n of names) {
    const re = new RegExp(`(?<![\\w.>])${escapeRe(n)}\\s*\\(`, "g");
    for (let m = re.exec(masked); m; m = re.exec(masked)) {
      // Walk to the parameter list's closing parenthesis.
      let depth = 0;
      let i = m.index + m[0].length - 1;
      for (; i < masked.length; i++) {
        if (masked[i] === "(") depth++;
        else if (masked[i] === ")" && --depth === 0) break;
      }
      // A definition's body follows (after any qualifiers like const, noexcept or an attribute).
      let j = i + 1;
      while (j < masked.length && /[\s\w:()]/.test(masked[j]) && masked[j] !== "{" && masked[j] !== ";") j++;
      if (masked[j] !== "{") continue;
      let k = j;
      depth = 0;
      for (; k < masked.length; k++) {
        if (masked[k] === "{") depth++;
        else if (masked[k] === "}" && --depth === 0) break;
      }
      let start = lineOf(text, m.index);
      const lines = text.split("\n");
      // The return type and qualifiers may sit on the lines before the name.
      while (start > 1 && /^\s*[\w*&:<>,\s]+$/.test(lines[start - 2]) && lines[start - 2].trim() && !/[;{}]\s*$/.test(lines[start - 2]))
        start--;
      // The comment directly above describes it.
      if (start > 1 && /\*\/\s*$/.test(lines[start - 2])) {
        let c = start - 1;
        while (c > 1 && !lines[c - 1].includes("/*")) c--;
        start = c;
      } else {
        while (start > 1 && /^\s*\/\//.test(lines[start - 2])) start--;
      }
      return { kind: "c", start, end: lineOf(text, Math.min(k, masked.length - 1)) };
    }
  }
  // Written under another C name and tied to this one with an asm label:
  // `int helper_r(int x) __asm__("func_0011B4C8");` — find the C name and look for that.
  for (const n of names) {
    const label = new RegExp(`__asm(__)?\\s*\\(\\s*"${escapeRe(n)}"\\s*\\)`).exec(text);
    if (!label) continue;
    const before = masked.slice(0, label.index);
    const statement = before.slice(Math.max(before.lastIndexOf(";"), before.lastIndexOf("}")) + 1);
    const alias = /([A-Za-z_]\w*)\s*\(/.exec(statement)?.[1];
    if (alias && alias !== n) {
      const found = findFunction(text, alias);
      if (found?.kind === "c") return found;
    }
  }
  // Not written in C (yet): find the line that pulls in its assembly. Projects name these macros
  // differently (INCLUDE_ASM, GLOBAL_ASM, ASM_FUNC, LINKER_REMNANT…): any all-caps call naming it.
  const lines = text.split("\n");
  for (const n of names) {
    const asm = new RegExp(`^\\s*(#\\s*pragma\\s+)?[A-Z][A-Z0-9_]*\\s*\\(.*\\b${escapeRe(n)}\\b`);
    const at = lines.findIndex((l) => asm.test(l));
    if (at >= 0) return { kind: "asm", start: at + 1, end: at + 1 };
  }
  return null;
}

/** A source path from a report, if it's safe to ask a repository for: relative, no "..". */
export function cleanSourcePath(path: string | null | undefined): string | null {
  if (!path) return null;
  const p = path.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  if (!p || p.startsWith("/") || /^[a-z]:/i.test(p) || p.split("/").some((s) => s === ".." || s === "") || p.length > 400) return null;
  return p;
}

// ---- Highlighting ----

export type TokenKind = "comment" | "string" | "keyword" | "type" | "number" | "preproc" | "plain";

const KEYWORDS = new Set(
  "if else for while do switch case default break continue return goto sizeof typedef struct union enum static extern const volatile inline register restrict auto class namespace template typename public private protected virtual override new delete this using operator friend true false nullptr NULL".split(
    " ",
  ),
);
const TYPES = /^(void|char|short|int|long|float|double|signed|unsigned|bool|s8|s16|s32|s64|u8|u16|u32|u64|f32|f64|size_t|u_\w+|\w+_t)$/;

/** One line's tokens. `inComment` carries a block comment over from the line before. */
export function highlightLine(line: string, inComment: boolean): { tokens: [TokenKind, string][]; inComment: boolean } {
  const tokens: [TokenKind, string][] = [];
  let i = 0;
  const push = (k: TokenKind, s: string) => {
    if (!s) return;
    const last = tokens[tokens.length - 1];
    if (last && last[0] === k) last[1] += s;
    else tokens.push([k, s]);
  };
  if (inComment) {
    const end = line.indexOf("*/");
    if (end < 0) return { tokens: [["comment", line]], inComment: true };
    push("comment", line.slice(0, end + 2));
    i = end + 2;
  }
  if (!inComment && /^\s*#/.test(line)) return { tokens: [["preproc", line]], inComment: false };
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if (rest.startsWith("//")) {
      push("comment", rest);
      break;
    } else if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2);
      if (end < 0) {
        push("comment", rest);
        return { tokens, inComment: true };
      }
      push("comment", rest.slice(0, end + 2));
      i += end + 2;
    } else if ((m = rest.match(/^"(?:\\.|[^"\\])*"?|^'(?:\\.|[^'\\])*'?/))) {
      push("string", m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^(0x[0-9a-fA-F]+|\d+\.?\d*(e[+-]?\d+)?)[uUlLfF]*/))) {
      push("number", m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Za-z_]\w*/))) {
      push(KEYWORDS.has(m[0]) ? "keyword" : TYPES.test(m[0]) ? "type" : "plain", m[0]);
      i += m[0].length;
    } else {
      push("plain", line[i]);
      i++;
    }
  }
  return { tokens, inComment: false };
}

/** Every line's tokens, carrying block comments from line to line. */
export function highlight(code: string): [TokenKind, string][][] {
  const rows: [TokenKind, string][][] = [];
  let inComment = false;
  for (const line of code.split("\n")) {
    const r = highlightLine(line, inComment);
    inComment = r.inComment;
    rows.push(r.tokens);
  }
  return rows;
}
