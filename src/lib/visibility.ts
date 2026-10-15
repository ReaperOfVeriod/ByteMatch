/**
 * Whether a project is kept off public pages (list, project page, badges, JSON). A project is
 * hidden while GitHub says its repository is gone (deleted, made private or blocked), or while it
 * has an error and has never produced a report. Missing access on ByteMatch's side (the App not
 * installed yet, no GITHUB_TOKEN) does not hide a project that already has history. Its admins still see it on
 * the manage page, syncing keeps retrying, and it reappears on its own once a sync succeeds
 * (success clears the error).
 */
export const ACCESS_ERROR_PATTERN = "^not found|\\b404\\b|repository access blocked|\\b451\\b";
const ACCESS_ERROR = new RegExp(ACCESS_ERROR_PATTERN, "i");

export function hiddenFromPublic(project: { enabled: boolean; lastError: string | null }, hasReports: boolean): boolean {
  if (!project.enabled) return true;
  if (!project.lastError) return false;
  return !hasReports || ACCESS_ERROR.test(project.lastError);
}
