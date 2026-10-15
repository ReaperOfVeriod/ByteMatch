/**
 * The unit filter: words match unit names; `<70%` / `>=50%` compare matched code; `>10kb` /
 * `<2mb` / `>512b` compare code size. Everything must hold, e.g. "camera <70% >10kb".
 */
export interface FilterableUnit {
  name: string;
  totalCode: number;
  matchedCodePercent: number;
}

type Test = (u: FilterableUnit) => boolean;

const UNITS: Record<string, number> = { b: 1, kb: 1024, k: 1024, mb: 1024 * 1024, m: 1024 * 1024 };

function compare(op: string, a: number, b: number): boolean {
  switch (op) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    default:
      return a === b;
  }
}

export function parseUnitFilter(query: string): Test {
  const tests: Test[] = [];
  for (const token of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const pct = /^(<=|>=|<|>|=)(\d+(?:\.\d+)?)%$/.exec(token);
    if (pct) {
      const [, op, n] = pct;
      tests.push((u) => compare(op, u.matchedCodePercent, Number(n)));
      continue;
    }
    const size = /^(<=|>=|<|>|=)(\d+(?:\.\d+)?)(b|kb|k|mb|m)$/.exec(token);
    if (size) {
      const [, op, n, unit] = size;
      const bytes = Number(n) * UNITS[unit];
      tests.push((u) => compare(op, u.totalCode, bytes));
      continue;
    }
    tests.push((u) => u.name.toLowerCase().includes(token));
  }
  return (u) => tests.every((t) => t(u));
}
