import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/auth/session";
import { GitHubMark } from "@/components/ui/icons";
import { config, signInConfigured } from "@/lib/config";
import { loginMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata {
  return loginMetadata();
}

const safeNext = (next: string | undefined) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/manage");

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentSession().catch(() => null)) redirect(next);
  const ready = signInConfigured();
  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="panel p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Sign in to {config().SITE_NAME}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Your GitHub account is your {config().SITE_NAME} account. Signing in for the first time creates it; there is no separate password.
        </p>
        {ready ? (
          <a href={`/auth/login?next=${encodeURIComponent(next)}`} className="btn btn-primary mt-6 w-full">
            <GitHubMark />
            Continue with GitHub
          </a>
        ) : (
          <p className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Sign-in isn&apos;t set up on this instance yet. The operator needs to configure the GitHub App (see the self-hosting docs).
          </p>
        )}
        <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-ink-2">
          <li>Submit projects you administer on GitHub.</li>
          <li>Manage settings, upload tokens and history imports.</li>
          <li>{config().SITE_NAME} only reads your profile and which repositories you administer.</li>
        </ul>
      </div>
    </div>
  );
}
