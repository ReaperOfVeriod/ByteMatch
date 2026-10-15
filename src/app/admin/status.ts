import { hiddenFromPublic } from "@/lib/visibility";

export type ProjectStatus = "healthy" | "syncing" | "erroring" | "hidden" | "disabled";

export function projectStatus(p: { enabled: boolean; lastError: string | null }, hasReports: boolean): ProjectStatus {
  if (!p.enabled) return "disabled";
  if (hiddenFromPublic(p, hasReports)) return "hidden";
  if (p.lastError) return "erroring";
  return hasReports ? "healthy" : "syncing";
}

export const STATUS_STYLE: Record<ProjectStatus, string> = {
  healthy: "bg-done/15 text-good",
  syncing: "bg-accent/15 text-accent",
  erroring: "bg-[#eda100]/15 text-[#f0b429]",
  hidden: "bg-bad/15 text-bad",
  disabled: "bg-surface-3 text-ink-3",
};
