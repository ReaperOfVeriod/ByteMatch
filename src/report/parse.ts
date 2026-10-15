import protobuf from "protobufjs";
import { calcMatchedPercent, addMeasures, finishSum } from "./measures";
import { CHANGES_PROTO, REPORT_PROTO } from "./proto/schema";
import {
  emptyMeasures,
  MEASURE_KEYS,
  REPORT_VERSION,
  type Measures,
  type Report,
  type ReportCategory,
  type ReportItem,
  type ReportUnit,
  type ReportUnitMetadata,
} from "./types";

export class ReportError extends Error {}

let root: protobuf.Root | undefined;

/** The objdiff protobuf schema (report.proto and changes.proto in one root). */
export function protoRoot(): protobuf.Root {
  if (!root) {
    root = new protobuf.Root();
    protobuf.parse(REPORT_PROTO, root, { keepCase: true });
    protobuf.parse(`syntax = "proto3";\npackage objdiff.report;\n${CHANGES_PROTO}`, root, { keepCase: true });
    root.resolveAll();
  }
  return root;
}

const reportType = () => protoRoot().lookupType("objdiff.report.Report");

// ---------------------------------------------------------------------------------------------
// Loose input → typed values. JSON reports come from objdiff (snake_case, 64-bit numbers as
// strings), from the protobuf canonical JSON mapping (lowerCamelCase), or from tools that write
// plain numbers; protobufjs hands back Long objects. All of them end up as numbers here.

type Loose = Record<string, unknown>;

const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function field(obj: Loose | undefined, key: string): unknown {
  if (!obj) return undefined;
  return key in obj ? obj[key] : obj[camel(key)];
}

function num(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = value.startsWith("0x") ? parseInt(value.slice(2), 16) : Number(value);
    if (!Number.isFinite(n)) throw new ReportError(`not a number: ${JSON.stringify(value)}`);
    return n;
  }
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value && "low" in value && "high" in value) {
    const long = value as { low: number; high: number; unsigned?: boolean };
    return (long.high >>> 0) * 2 ** 32 + (long.low >>> 0);
  }
  throw new ReportError(`not a number: ${JSON.stringify(value)}`);
}

/** A float32 field as objdiff prints it: the shortest decimal that reads back as the same float32. */
export function f32(value: number): number {
  const single = Math.fround(value);
  if (!Number.isFinite(single)) return 0;
  for (let digits = 1; digits <= 9; digits++) {
    const candidate = Number(single.toPrecision(digits));
    if (Math.fround(candidate) === single) return candidate;
  }
  return single;
}

const FLOAT_KEYS = new Set([
  "fuzzy_match_percent",
  "matched_code_percent",
  "matched_data_percent",
  "matched_functions_percent",
  "complete_code_percent",
  "complete_data_percent",
]);

function optNum(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : num(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function obj(value: unknown): Loose | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : undefined;
}

function list(value: unknown): Loose[] {
  return Array.isArray(value) ? value.filter((v): v is Loose => !!obj(v)) : [];
}

function measures(value: unknown): Measures {
  const src = obj(value);
  const m = emptyMeasures();
  for (const key of MEASURE_KEYS) m[key] = FLOAT_KEYS.has(key) ? f32(num(field(src, key))) : num(field(src, key));
  return m;
}

function item(src: Loose): ReportItem {
  const meta = obj(field(src, "metadata"));
  const out: ReportItem = {
    name: str(field(src, "name")),
    size: num(field(src, "size")),
    fuzzy_match_percent: f32(num(field(src, "fuzzy_match_percent"))),
  };
  if (meta) {
    out.metadata = {};
    const demangled = optStr(field(meta, "demangled_name"));
    const va = optNum(field(meta, "virtual_address"));
    if (demangled !== undefined) out.metadata.demangled_name = demangled;
    if (va !== undefined) out.metadata.virtual_address = va;
  }
  const address = optNum(field(src, "address"));
  if (address !== undefined) out.address = address;
  return out;
}

function unitMetadata(value: unknown): ReportUnitMetadata | undefined {
  const meta = obj(value);
  if (!meta) return undefined;
  const out: ReportUnitMetadata = {
    progress_categories: (Array.isArray(field(meta, "progress_categories")) ? (field(meta, "progress_categories") as unknown[]) : []).map(
      str,
    ),
  };
  const complete = field(meta, "complete");
  if (typeof complete === "boolean") out.complete = complete;
  const moduleName = optStr(field(meta, "module_name"));
  if (moduleName !== undefined) out.module_name = moduleName;
  const moduleId = optNum(field(meta, "module_id"));
  if (moduleId !== undefined) out.module_id = moduleId;
  const sourcePath = optStr(field(meta, "source_path"));
  if (sourcePath !== undefined) out.source_path = sourcePath;
  const auto = field(meta, "auto_generated");
  if (typeof auto === "boolean") out.auto_generated = auto;
  return out;
}

function unit(src: Loose): ReportUnit {
  return {
    name: str(field(src, "name")),
    measures: measures(field(src, "measures")),
    sections: list(field(src, "sections")).map(item),
    functions: list(field(src, "functions")).map(item),
    metadata: unitMetadata(field(src, "metadata")),
  };
}

function category(src: Loose): ReportCategory {
  return { id: str(field(src, "id")), name: str(field(src, "name")), measures: measures(field(src, "measures")) };
}

/** A current-format report object (JSON or decoded protobuf). */
function fromObject(src: Loose): Report {
  if (!obj(field(src, "measures"))) throw new ReportError("report has no measures");
  return {
    measures: measures(field(src, "measures")),
    units: list(field(src, "units")).map(unit),
    version: num(field(src, "version")),
    categories: list(field(src, "categories")).map(category),
  };
}

/** objdiff's pre-protobuf JSON: measures at the top level and on each unit, hex addresses. */
function fromLegacy(src: Loose): Report {
  const top = emptyMeasures();
  for (const key of [
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
  ] as const) {
    top[key] = num(src[key]);
  }
  const legacyItem = (it: Loose): ReportItem => {
    const out: ReportItem = { name: str(it.name), size: num(it.size), fuzzy_match_percent: num(it.fuzzy_match_percent), metadata: {} };
    if (typeof it.demangled_name === "string") out.metadata!.demangled_name = it.demangled_name;
    if (typeof it.address === "string" && it.address !== "") {
      if (!it.address.startsWith("0x")) throw new ReportError("legacy report address is not a hex string");
      out.metadata!.virtual_address = parseInt(it.address.slice(2), 16);
    }
    return out;
  };
  const units = list(src.units).map((u): ReportUnit => {
    const m = emptyMeasures();
    for (const key of [
      "fuzzy_match_percent",
      "total_code",
      "matched_code",
      "total_data",
      "matched_data",
      "total_functions",
      "matched_functions",
    ] as const) {
      m[key] = num(u[key]);
    }
    calcMatchedPercent(m);
    const metadata: ReportUnitMetadata = { progress_categories: [] };
    if (typeof u.complete === "boolean") metadata.complete = u.complete;
    if (typeof u.module_name === "string") metadata.module_name = u.module_name;
    if (u.module_id !== undefined && u.module_id !== null) metadata.module_id = num(u.module_id);
    return {
      name: str(u.name),
      measures: m,
      sections: list(u.sections).map(legacyItem),
      functions: list(u.functions).map(legacyItem),
      metadata,
    };
  });
  return { measures: top, units, version: 0, categories: [] };
}

// ---------------------------------------------------------------------------------------------
// Migrations, as objdiff's Report::migrate does them.

/** Version 0 → 1: complete code/data, and "dol"/"modules" progress categories. */
function migrateV0(report: Report) {
  for (const u of report.units) {
    const meta = (u.metadata ??= { progress_categories: [] });
    meta.progress_categories = meta.module_name !== undefined || meta.module_id !== undefined ? ["modules"] : ["dol"];
    const complete = meta.complete ?? false;
    u.measures.complete_code = complete ? u.measures.total_code : 0;
    u.measures.complete_data = complete ? u.measures.total_data : 0;
    u.measures.complete_code_percent = complete ? 100 : 0;
    u.measures.complete_data_percent = complete ? 100 : 0;
    report.measures.complete_code += u.measures.complete_code;
    report.measures.complete_data += u.measures.complete_data;
  }
  calcMatchedPercent(report.measures);
  calculateProgressCategories(report);
  report.version = 1;
}

/** Version 1 → 2: unit counts. */
function migrateV1(report: Report) {
  for (const u of report.units) {
    const complete = u.metadata?.complete ? 1 : 0;
    u.measures.total_units = 1;
    u.measures.complete_units = complete;
    report.measures.total_units += 1;
    report.measures.complete_units += complete;
    for (const id of u.metadata?.progress_categories ?? []) {
      const c = report.categories.find((x) => x.id === id);
      if (c) {
        c.measures.total_units += 1;
        c.measures.complete_units += complete;
      }
    }
  }
  report.version = 2;
}

/** Builds (or tops up) category measures from the units' progress_categories. */
export function calculateProgressCategories(report: Report) {
  const sums = new Map<string, Measures>();
  for (const c of report.categories) {
    // Existing measures are accumulated into, so start their fuzzy sum code-weighted.
    c.measures.fuzzy_match_percent *= c.measures.total_code;
    sums.set(c.id, c.measures);
  }
  for (const u of report.units) {
    for (const id of u.metadata?.progress_categories ?? []) {
      let m = sums.get(id);
      if (!m) {
        m = emptyMeasures();
        report.categories.push({ id, name: "", measures: m });
        sums.set(id, m);
      }
      addMeasures(m, u.measures);
    }
  }
  for (const c of report.categories) finishSum(c.measures);
}

export function migrate(report: Report): Report {
  if (report.version === 0) migrateV0(report);
  if (report.version === 1) migrateV1(report);
  if (report.version !== REPORT_VERSION) throw new ReportError(`unsupported report version ${report.version}`);
  return report;
}

// ---------------------------------------------------------------------------------------------

/** Parses an objdiff report from JSON text or binary protobuf, migrated to version 2. */
export function parseReport(data: Uint8Array | string): Report {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let start = 0;
  while (
    start < bytes.length &&
    (bytes[start] === 0x20 ||
      bytes[start] === 0x0a ||
      bytes[start] === 0x0d ||
      bytes[start] === 0x09 ||
      bytes[start] === 0xef ||
      bytes[start] === 0xbb ||
      bytes[start] === 0xbf)
  )
    start++;
  if (start >= bytes.length) throw new ReportError("empty report");
  let report: Report;
  if (bytes[start] === 0x7b /* { */) {
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(start)));
    } catch (e) {
      throw new ReportError(`report is not valid JSON: ${(e as Error).message}`);
    }
    const src = obj(json)!;
    report = obj(field(src, "measures")) ? fromObject(src) : "fuzzy_match_percent" in src ? fromLegacy(src) : fromObject(src);
  } else {
    let decoded: Loose;
    try {
      const type = reportType();
      decoded = type.toObject(type.decode(bytes), { longs: String, defaults: true, arrays: true }) as Loose;
    } catch (e) {
      throw new ReportError(`report is neither JSON nor objdiff protobuf: ${(e as Error).message}`);
    }
    report = fromObject(decoded);
  }
  return migrate(report);
}

/** Binary protobuf, the compact form reports are stored in. */
export function encodeReport(report: Report): Uint8Array {
  const type = reportType();
  const message = type.fromObject(report as unknown as Record<string, unknown>);
  return type.encode(message).finish();
}

/**
 * Splits a report that holds several game versions into one report per version, as objdiff's
 * Report::split does: top-level categories are versions, "version.category" are their categories,
 * and unit names may carry a "version/" prefix.
 */
export function splitReport(report: Report): Map<string, Report> {
  const out = new Map<string, Report>();
  const taken = new Set<ReportUnit>();
  const isSub = (id: string, parent: string) => id.startsWith(`${parent}.`);
  for (const top of report.categories) {
    if (top.id.includes(".")) continue;
    const categories = report.categories.filter((c) => isSub(c.id, top.id)).map((c) => ({ ...c, id: c.id.slice(top.id.length + 1) }));
    const units: ReportUnit[] = [];
    for (const u of report.units) {
      if (taken.has(u) || !u.metadata?.progress_categories.includes(top.id)) continue;
      taken.add(u);
      units.push({
        ...u,
        name: u.name.startsWith(`${top.id}/`) ? u.name.slice(top.id.length + 1) : u.name,
        metadata: u.metadata && {
          ...u.metadata,
          progress_categories: u.metadata.progress_categories.filter((c) => isSub(c, top.id)).map((c) => c.slice(top.id.length + 1)),
        },
      });
    }
    out.set(top.id, { measures: top.measures, units, version: report.version, categories });
  }
  return out;
}
