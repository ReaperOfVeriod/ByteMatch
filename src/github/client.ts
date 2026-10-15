import { App, Octokit } from "octokit";
import { config, githubAppConfigured } from "../lib/config";

let app: App | undefined;

/** The GitHub App, when GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are set. */
export function githubApp(): App | undefined {
  if (!githubAppConfigured()) return undefined;
  const c = config();
  return (app ??= new App({
    appId: c.GITHUB_APP_ID!,
    privateKey: c.GITHUB_APP_PRIVATE_KEY!,
    webhooks: { secret: c.GITHUB_WEBHOOK_SECRET ?? "unused" },
    ...(c.GITHUB_CLIENT_ID && c.GITHUB_CLIENT_SECRET
      ? { oauth: { clientId: c.GITHUB_CLIENT_ID, clientSecret: c.GITHUB_CLIENT_SECRET } }
      : {}),
  }));
}

/** A client on the server's own token (GITHUB_TOKEN), or anonymous. */
export function tokenClient(): Octokit {
  const token = config().GITHUB_TOKEN;
  return new Octokit(token ? { auth: token } : {});
}

export function userClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export class NoGitHubAccess extends Error {}

/** The App's installation on OWNER/REPO, if it has one. */
export async function findInstallation(owner: string, repo: string): Promise<number | undefined> {
  const a = githubApp();
  if (!a) return undefined;
  try {
    const { data } = await a.octokit.request("GET /repos/{owner}/{repo}/installation", { owner, repo });
    return data.id;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return undefined;
    throw e;
  }
}

/**
 * A client that can read REPO's Actions artifacts: the App's installation token when the App is
 * installed there, else GITHUB_TOKEN. GitHub requires authentication to download artifacts,
 * even from public repositories, so one of the two must be configured.
 */
export async function repoClient(project: {
  owner: string;
  repo: string;
  installationId: number | null;
}): Promise<{ octokit: Octokit; installationId?: number }> {
  const a = githubApp();
  if (a) {
    const id = project.installationId ?? (await findInstallation(project.owner, project.repo));
    if (id) return { octokit: (await a.getInstallationOctokit(id)) as unknown as Octokit, installationId: id };
  }
  if (config().GITHUB_TOKEN) return { octokit: tokenClient() };
  throw new NoGitHubAccess(`no GitHub access to ${project.owner}/${project.repo}: install the GitHub App there or set GITHUB_TOKEN`);
}
