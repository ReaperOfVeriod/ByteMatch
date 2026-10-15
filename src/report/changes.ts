import type { Measures, Report, ReportItem, ReportUnitMetadata, ReportItemMetadata } from "./types";
import { MEASURE_KEYS } from "./types";

/** objdiff-core/protos/changes.proto: what changed between two reports. */
export interface ChangeItemInfo {
  fuzzy_match_percent: number;
  size: number;
}

export interface ChangeItem {
  name: string;
  from?: ChangeItemInfo;
  to?: ChangeItemInfo;
  metadata?: ReportItemMetadata;
}

export interface ChangeUnit {
  name: string;
  from?: Measures;
  to?: Measures;
  sections: ChangeItem[];
  functions: ChangeItem[];
  metadata?: ReportUnitMetadata;
}

export interface Changes {
  from: Measures;
  to: Measures;
  units: ChangeUnit[];
}

const sameMeasures = (a: Measures, b: Measures) => MEASURE_KEYS.every((k) => a[k] === b[k]);

function itemChanges(from: ReportItem[], to: ReportItem[]): ChangeItem[] {
  const before = new Map(from.map((i) => [i.name, i]));
  const out: ChangeItem[] = [];
  const info = (i: ReportItem): ChangeItemInfo => ({ fuzzy_match_percent: i.fuzzy_match_percent, size: i.size });
  for (const item of to) {
    const old = before.get(item.name);
    before.delete(item.name);
    if (old && old.fuzzy_match_percent === item.fuzzy_match_percent && old.size === item.size) continue;
    out.push({ name: item.name, from: old && info(old), to: info(item), metadata: item.metadata });
  }
  for (const old of before.values()) out.push({ name: old.name, from: info(old), metadata: old.metadata });
  return out;
}

/** Units and items whose progress differs between FROM and TO. */
export function reportChanges(from: Report, to: Report): Changes {
  const before = new Map(from.units.map((u) => [u.name, u]));
  const units: ChangeUnit[] = [];
  for (const u of to.units) {
    const old = before.get(u.name);
    before.delete(u.name);
    if (old && sameMeasures(old.measures, u.measures)) continue;
    units.push({
      name: u.name,
      from: old?.measures,
      to: u.measures,
      sections: itemChanges(old?.sections ?? [], u.sections),
      functions: itemChanges(old?.functions ?? [], u.functions),
      metadata: u.metadata,
    });
  }
  for (const old of before.values()) {
    units.push({
      name: old.name,
      from: old.measures,
      sections: itemChanges(old.sections, []),
      functions: itemChanges(old.functions, []),
      metadata: old.metadata,
    });
  }
  return { from: from.measures, to: to.measures, units };
}

/** A function counts as matched at 100% fuzzy match. */
export const isMatched = (info?: ChangeItemInfo) => !!info && info.fuzzy_match_percent >= 100;

export interface ChangeSummary {
  newlyMatched: ChangeItem[];
  regressed: ChangeItem[];
  improved: ChangeItem[];
  worsened: ChangeItem[];
}

/** Sorts changed functions into the buckets a PR comment lists. */
export function summarizeFunctions(changes: Changes): ChangeSummary {
  const s: ChangeSummary = { newlyMatched: [], regressed: [], improved: [], worsened: [] };
  for (const u of changes.units) {
    for (const f of u.functions) {
      const was = f.from?.fuzzy_match_percent ?? 0;
      const now = f.to?.fuzzy_match_percent ?? 0;
      if (isMatched(f.to) && !isMatched(f.from)) s.newlyMatched.push(f);
      else if (isMatched(f.from) && !isMatched(f.to)) s.regressed.push(f);
      else if (now > was) s.improved.push(f);
      else if (now < was) s.worsened.push(f);
    }
  }
  const bySize = (a: ChangeItem, b: ChangeItem) => (b.to?.size ?? b.from?.size ?? 0) - (a.to?.size ?? a.from?.size ?? 0);
  for (const list of Object.values(s)) list.sort(bySize);
  return s;
}
