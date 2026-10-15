/**
 * Why a project's reports couldn't be read, in words its maintainers can act on. Ingest raises
 * ReportProblem for problems with a run's artifact (the run is then recorded and skipped, not
 * retried forever); anything else is a sync failure the worker retries. Both are explained here.
 */

export type ProblemCode =
  "no-report-file" | "artifact-empty" | "artifact-too-big" | "report-unreadable" | "no-access" | "rate-limited" | "decompdev" | "unknown";

export interface ProblemDetail {
  /** Files found in the artifact, for no-report-file. */
  files?: string[];
  limit?: number;
}

/** A problem with one run's artifact: retrying won't help until the workflow (or setting) changes. */
export class ReportProblem extends Error {
  constructor(
    readonly code: Exclude<ProblemCode, "no-access" | "rate-limited" | "decompdev" | "unknown">,
    message: string,
    readonly detail: ProblemDetail = {},
  ) {
    super(message);
    this.name = "ReportProblem";
  }
}

/** Where a problem happened, when known. */
export interface ProblemPlace {
  artifact?: string | null;
  runUrl?: string | null;
  runId?: number | null;
}

export interface Explanation {
  title: string;
  /** What happened, in a sentence or two. */
  what: string;
  /** What to do about it, step by step. */
  fix: string[];
  /** A docs page that covers it. */
  docs?: { href: string; label: string };
}

/** The problem code behind a stored error message, for errors stored as text. */
export function problemCode(message: string): ProblemCode {
  const m = message.toLowerCase();
  if (m.includes("none is report.json")) return "no-report-file";
  if (m.includes("artifact is empty")) return "artifact-empty";
  if (m.includes("unpacks to more than")) return "artifact-too-big";
  if (m.includes("report") && (m.includes("parse") || m.includes("json") || m.includes("protobuf") || m.includes("invalid")))
    return "report-unreadable";
  if (m.includes("no github access") || m.includes("not found") || m.includes("404") || m.includes("resource not accessible"))
    return "no-access";
  if (m.includes("rate limit") || m.includes("429") || m.includes("secondary rate")) return "rate-limited";
  if (m.includes("decomp.dev")) return "decompdev";
  return "unknown";
}

const fileName = (path: string) => path.split("/").pop() ?? path;

export function explain(code: ProblemCode, detail: ProblemDetail = {}, place: ProblemPlace = {}): Explanation {
  const artifact = place.artifact ? `the artifact “${place.artifact}”` : "a report artifact";
  const reportDocs = { href: "/docs/getting-started#2-get-reports-to-bytematch", label: "Getting reports to ByteMatch" };
  switch (code) {
    case "no-report-file": {
      const files = detail.files ?? [];
      const names = files.map(fileName);
      const listed = files.length ? ` It contains ${files.map((f) => `“${f}”`).join(", ")}, but no report.` : "";
      const fix = [
        "Have the workflow write objdiff's progress report, e.g. with `objdiff-cli report generate -o report.json` (dtk-template's build does this for you).",
        "Upload that report file in the artifact, alone or named report.json.",
      ];
      if (names.includes("objdiff.json")) {
        fix.unshift("objdiff.json is objdiff's project configuration, not its progress report, so ByteMatch can't use it.");
      }
      fix.push(
        "If this artifact isn't meant to be a report at all, narrow the Artifact pattern in the project's settings (Manage → Settings → Advanced) so ByteMatch ignores it.",
      );
      return { title: "The artifact has no objdiff report in it", what: `ByteMatch opened ${artifact}.${listed}`, fix, docs: reportDocs };
    }
    case "artifact-empty":
      return {
        title: "The report artifact is empty",
        what: `${capital(artifact)} has no files in it.`,
        fix: [
          "Check the upload step's path in the workflow: it should point at the report file objdiff-cli writes.",
          "actions/upload-artifact uploads nothing (and doesn't fail) when the path matches no files unless `if-no-files-found: error` is set.",
        ],
        docs: reportDocs,
      };
    case "artifact-too-big":
      return {
        title: "The report artifact is too large",
        what: `${capital(artifact)} unpacks to more than ${detail.limit ? `${Math.round(detail.limit / 1024 / 1024)} MB` : "the size limit"}, so ByteMatch didn't read it.`,
        fix: [
          "Upload only the report file, not the whole build directory.",
          "If the report itself is this large, upload it in objdiff's binary format (report.binpb), which is much smaller.",
        ],
        docs: reportDocs,
      };
    case "report-unreadable":
      return {
        title: "The report couldn't be read",
        what: `${capital(artifact)} holds a file ByteMatch couldn't read as an objdiff report.`,
        fix: [
          "Make sure the artifact contains the file `objdiff-cli report generate` writes, unchanged.",
          "Use a current objdiff-cli; ByteMatch reads its JSON and binary report formats, and older ones it can migrate.",
        ],
        docs: reportDocs,
      };
    case "no-access":
      return {
        title: "ByteMatch can't see this repository's CI runs",
        what: "GitHub refused access to the repository or its workflow runs. It may be private, renamed, or the ByteMatch GitHub App isn't installed on it.",
        fix: [
          "Install the ByteMatch GitHub App on the repository (or give it access to this repository if it's installed on the account).",
          "If the repository was renamed or moved, ByteMatch follows it automatically once it can reach it.",
        ],
        docs: { href: "/docs/getting-started", label: "Getting started" },
      };
    case "rate-limited":
      return {
        title: "GitHub is limiting requests",
        what: "GitHub asked ByteMatch to slow down. Nothing is wrong with the project; syncing resumes on its own.",
        fix: ["Nothing to do. Installing the ByteMatch GitHub App on the repository gives it its own, larger allowance."],
      };
    case "decompdev":
      return {
        title: "Importing history from decomp.dev failed",
        what: "decomp.dev didn't return this project's history. It may be down, or may not have had the project.",
        fix: [
          "ByteMatch retries on its own. If decomp.dev has gone for good, upload a saved history file on the project's manage page (History) instead.",
        ],
        docs: { href: "/docs/migrating-from-decomp-dev", label: "Migrating from decomp.dev" },
      };
    default:
      return {
        title: "The last sync failed",
        what: "Something went wrong reading this project's CI runs. ByteMatch retries on its own.",
        fix: ["If this keeps happening, ask on the ByteMatch Discord and include the technical details below."],
      };
  }
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
