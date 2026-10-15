import { emptyMeasures, type MeasureKey, type Measures } from "./types";

// Arithmetic follows objdiff's (objdiff-core/src/bindings/report.rs, MIT OR Apache-2.0) so that
// numbers computed here agree with the ones objdiff writes: a total of zero counts as 100%.

const percent = (part: number, total: number) => (total === 0 ? 100 : (part / total) * 100);

/** Fills in the five "matched" and "complete" percentages from the byte and function counts. */
export function calcMatchedPercent(m: Measures): Measures {
  m.matched_code_percent = percent(m.matched_code, m.total_code);
  m.matched_data_percent = percent(m.matched_data, m.total_data);
  m.matched_functions_percent = percent(m.matched_functions, m.total_functions);
  m.complete_code_percent = percent(m.complete_code, m.total_code);
  m.complete_data_percent = percent(m.complete_data, m.total_data);
  return m;
}

/** Adds OTHER into SUM; fuzzy_match_percent accumulates code-weighted until finishSum. */
export function addMeasures(sum: Measures, other: Measures): Measures {
  sum.fuzzy_match_percent += other.fuzzy_match_percent * other.total_code;
  sum.total_code += other.total_code;
  sum.matched_code += other.matched_code;
  sum.total_data += other.total_data;
  sum.matched_data += other.matched_data;
  sum.total_functions += other.total_functions;
  sum.matched_functions += other.matched_functions;
  sum.complete_code += other.complete_code;
  sum.complete_data += other.complete_data;
  sum.total_units += other.total_units;
  sum.complete_units += other.complete_units;
  return sum;
}

/** Turns an addMeasures accumulation into proper percentages. */
export function finishSum(sum: Measures): Measures {
  sum.fuzzy_match_percent = sum.total_code === 0 ? 100 : sum.fuzzy_match_percent / sum.total_code;
  return calcMatchedPercent(sum);
}

export function sumMeasures(all: Iterable<Measures>): Measures {
  const sum = emptyMeasures();
  for (const m of all) addMeasures(sum, m);
  return finishSum(sum);
}

/** How a measure reads in a badge or table: byte measures as a percent, counts as "done / total". */
export type MeasureFormat = { kind: "percent"; key: MeasureKey } | { kind: "count"; done: MeasureKey; total: MeasureKey };

/**
 * The measures a badge may show. Byte counts are shown as the matching percentage and the
 * function and unit counts as "done / total", which is what READMEs written for decomp.dev expect.
 */
export const BADGE_MEASURES: Record<string, MeasureFormat> = {
  fuzzy_match_percent: { kind: "percent", key: "fuzzy_match_percent" },
  matched_code: { kind: "percent", key: "matched_code_percent" },
  matched_code_percent: { kind: "percent", key: "matched_code_percent" },
  matched_data: { kind: "percent", key: "matched_data_percent" },
  matched_data_percent: { kind: "percent", key: "matched_data_percent" },
  complete_code: { kind: "percent", key: "complete_code_percent" },
  complete_code_percent: { kind: "percent", key: "complete_code_percent" },
  complete_data: { kind: "percent", key: "complete_data_percent" },
  complete_data_percent: { kind: "percent", key: "complete_data_percent" },
  matched_functions: { kind: "count", done: "matched_functions", total: "total_functions" },
  matched_functions_percent: { kind: "percent", key: "matched_functions_percent" },
  complete_units: { kind: "count", done: "complete_units", total: "total_units" },
};

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

export function formatCount(value: number): string {
  return integer.format(value);
}

export function formatMeasure(m: Measures, format: MeasureFormat): string {
  return format.kind === "percent" ? formatPercent(m[format.key]) : `${formatCount(m[format.done])} / ${formatCount(m[format.total])}`;
}

const SI = ["B", "KB", "MB", "GB"];

/** Byte counts for tables: 3.71 MB. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < SI.length - 1) {
    value /= 1000;
    unit++;
  }
  return unit === 0 ? `${integer.format(value)} B` : `${value.toFixed(2)} ${SI[unit]}`;
}
