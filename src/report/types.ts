/**
 * objdiff progress reports (objdiff-core/protos/report.proto, version 2), with every
 * 64-bit field as a JavaScript number. Reports stay far below 2^53 bytes.
 */

export const REPORT_VERSION = 2;

export interface Measures {
  fuzzy_match_percent: number;
  total_code: number;
  matched_code: number;
  matched_code_percent: number;
  total_data: number;
  matched_data: number;
  matched_data_percent: number;
  total_functions: number;
  matched_functions: number;
  matched_functions_percent: number;
  complete_code: number;
  complete_code_percent: number;
  complete_data: number;
  complete_data_percent: number;
  total_units: number;
  complete_units: number;
}

export type MeasureKey = keyof Measures;

export const MEASURE_KEYS: readonly MeasureKey[] = [
  "fuzzy_match_percent",
  "total_code",
  "matched_code",
  "matched_code_percent",
  "total_data",
  "matched_data",
  "matched_data_percent",
  "total_functions",
  "matched_functions",
  "matched_functions_percent",
  "complete_code",
  "complete_code_percent",
  "complete_data",
  "complete_data_percent",
  "total_units",
  "complete_units",
];

export interface ReportCategory {
  id: string;
  name: string;
  measures: Measures;
}

export interface ReportItemMetadata {
  demangled_name?: string;
  virtual_address?: number;
}

export interface ReportItem {
  name: string;
  size: number;
  fuzzy_match_percent: number;
  metadata?: ReportItemMetadata;
  address?: number;
}

export interface ReportUnitMetadata {
  complete?: boolean;
  module_name?: string;
  module_id?: number;
  source_path?: string;
  progress_categories: string[];
  auto_generated?: boolean;
}

export interface ReportUnit {
  name: string;
  measures: Measures;
  sections: ReportItem[];
  functions: ReportItem[];
  metadata?: ReportUnitMetadata;
}

export interface Report {
  measures: Measures;
  units: ReportUnit[];
  version: number;
  categories: ReportCategory[];
}

export function emptyMeasures(): Measures {
  return {
    fuzzy_match_percent: 0,
    total_code: 0,
    matched_code: 0,
    matched_code_percent: 0,
    total_data: 0,
    matched_data: 0,
    matched_data_percent: 0,
    total_functions: 0,
    matched_functions: 0,
    matched_functions_percent: 0,
    complete_code: 0,
    complete_code_percent: 0,
    complete_data: 0,
    complete_data_percent: 0,
    total_units: 0,
    complete_units: 0,
  };
}
