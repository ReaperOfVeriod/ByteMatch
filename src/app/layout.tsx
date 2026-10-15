import type { Metadata } from "next";
import Link from "next/link";
import { currentSession } from "@/auth/session";
import { config, signInConfigured } from "@/lib/config";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = config();
  return {
    title: { default: c.SITE_NAME, template: `%s · ${c.SITE_NAME}` },
    description: "Progress tracking for matching decompilation projects.",
    metadataBase: new URL(c.PUBLIC_URL),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession().catch(() => null);
  const name = config().SITE_NAME;
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="font-mono text-[15px] font-semibold tracking-tight">
              {name}
            </Link>
            <Link href="/" className="text-sm text-ink-2 hover:text-ink">
              Projects
            </Link>
            <a href="https://github.com/Veradictus/ByteMatch/tree/master/docs" className="text-sm text-ink-2 hover:text-ink">
              Docs
            </a>
            <div className="ml-auto flex items-center gap-4 text-sm">
              {session ? (
                <>
                  <Link href="/manage" className="text-ink-2 hover:text-ink">
                    Manage
                  </Link>
                  <span className="hidden text-ink-3 sm:inline">{session.user.login}</span>
                  <form action="/auth/logout" method="post">
                    <button className="text-ink-2 hover:text-ink">Sign out</button>
                  </form>
                </>
              ) : signInConfigured() ? (
                // A route handler that redirects to GitHub, not a page: a plain link, never prefetched.
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a href="/auth/login" className="rounded-md border border-line px-3 py-1.5 text-ink-2 hover:text-ink">
                  Sign in with GitHub
                </a>
              ) : null}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pt-4 pb-10 text-xs text-ink-3">
          {name} tracks matching decompilation progress from{" "}
          <a className="underline" href="https://github.com/encounter/objdiff">
            objdiff
          </a>{" "}
          reports.{" "}
          <a className="underline" href="https://github.com/Veradictus/ByteMatch">
            Source
          </a>{" "}
          (GPL-3.0).
        </footer>
      </body>
    </html>
  );
}
