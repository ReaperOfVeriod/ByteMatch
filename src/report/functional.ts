import type { Report } from "./types";

/**
 * Functional C ("backfill"): C a project has for functions it hasn't matched, which does what the
 * original does without compiling to the same bytes (a native port can use it; the matching build
 * can't). It is never progress: nothing here changes a measure. objdiff's report has no field for
 * it, so a project lists the functions in a file beside its report (docs/api.md), and ByteMatch
 * sizes them from the report.
 */

export const CONFIDENCES = ["high", "medium", "low", "unrated"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** Function name → how sure the project is that its C does what the original does. */
export type FunctionalList = Map<string, Confidence>;

export class FunctionalListError extends Error {}

const MAX_ENTRIES = 200_000;
const MAX_NAME = 512;

function confidence(v: unknown): Confidence {
  return typeof v === "string" && (CONFIDENCES as readonly string[]).includes(v.toLowerCase())
    ? (v.toLowerCase() as Confidence)
    : "unrated";
}

function add(list: FunctionalList, name: unknown, conf: unknown) {
  if (typeof name !== "string") return;
  const n = name.trim();
  if (!n || n.length > MAX_NAME) return;
  if (list.size >= MAX_ENTRIES) throw new FunctionalListError(`the list has more than ${MAX_ENTRIES} functions`);
  list.set(n, confidence(conf));
}

/**
 * Reads a functional list: JSON (`{"functions": [{"name": "...", "confidence": "high"}]}`, or just
 * the array, or an array of names) or TSV (a name per line, anything after a tab ignored except a
 * third column read as the confidence; `#` starts a comment line).
 */
export function parseFunctionalList(bytes: Uint8Array, fileName: string): FunctionalList {
  const text = new TextDecoder().decode(bytes);
  const list: FunctionalList = new Map();
  if (fileName.toLowerCase().endsWith(".json")) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new FunctionalListError(`${fileName} is not valid JSON`);
    }
    const items = Array.isArray(data) ? data : (data as { functions?: unknown })?.functions;
    if (!Array.isArray(items)) throw new FunctionalListError(`${fileName} should hold a "functions" array`);
    for (const item of items) {
      if (typeof item === "string") add(list, item, null);
      else if (item && typeof item === "object")
        add(list, (item as { name?: unknown }).name, (item as { confidence?: unknown }).confidence);
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith("#")) continue;
      const cols = line.split("\t");
      add(list, cols[0], cols[2]);
    }
  }
  return list;
}

export interface FunctionalPart {
  /** Bytes of code with functional C and no match yet. */
  code: number;
  /** Of the part's total code; 0 to 100. */
  code_percent: number;
  functions: number;
}

export interface FunctionalSummary extends FunctionalPart {
  /** Functions in the list. */
  listed: number;
  /** Listed but already matched: the list can drop them. Not counted above. */
  already_matched: number;
  /** Listed but not in this report (another version's, or renamed). */
  not_found: number;
  by_confidence: Record<Confidence, { functions: number; code: number }>;
  /** Per progress category id. */
  categories: Record<string, FunctionalPart>;
}

/** What the list adds up to against one report. Matched functions never count. */
export function summarizeFunctional(report: Report, list: FunctionalList): FunctionalSummary {
  const byConfidence = Object.fromEntries(CONFIDENCES.map((c) => [c, { functions: 0, code: 0 }])) as FunctionalSummary["by_confidence"];
  const categories: Record<string, { code: number; functions: number }> = {};
  const seen = new Set<string>();
  let code = 0;
  let functions = 0;
  let alreadyMatched = 0;
  for (const unit of report.units) {
    for (const f of unit.functions) {
      const name = list.has(f.name)
        ? f.name
        : f.metadata?.demangled_name && list.has(f.metadata.demangled_name)
          ? f.metadata.demangled_name
          : null;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      if (f.fuzzy_match_percent >= 100) {
        alreadyMatched++;
        continue;
      }
      const size = Number(f.size) || 0;
      code += size;
      functions++;
      const c = byConfidence[list.get(name)!];
      c.functions++;
      c.code += size;
      for (const id of unit.metadata?.progress_categories ?? []) {
        const part = (categories[id] ??= { code: 0, functions: 0 });
        part.code += size;
        part.functions++;
      }
    }
  }
  const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1e6) / 1e4 : 0);
  const totals = new Map(report.categories.map((c) => [c.id, Number(c.measures.total_code) || 0]));
  return {
    code,
    code_percent: pct(code, Number(report.measures.total_code) || 0),
    functions,
    listed: list.size,
    already_matched: alreadyMatched,
    not_found: list.size - seen.size,
    by_confidence: byConfidence,
    categories: Object.fromEntries(
      Object.entries(categories).map(([id, p]) => [id, { ...p, code_percent: pct(p.code, totals.get(id) ?? 0) }]),
    ),
  };
}

/** A list that couldn't be read is reported to the project's maintainers rather than dropped silently. */
export type StoredFunctional = FunctionalSummary | { error: string };

export const isSummary = (f: StoredFunctional | null | undefined): f is FunctionalSummary => !!f && !("error" in f);
