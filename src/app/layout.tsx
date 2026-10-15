import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";
import { currentSession } from "@/auth/session";
import { JsonLd } from "@/components/json-ld";
import { Chat } from "@/components/ui/icons";
import { siteJsonLd, siteMetadata } from "@/lib/seo";
import { config } from "@/lib/config";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata();
}

/** ByteMatch's mark: four units, three matched. */
function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="11" height="11" rx="2.5" fill="var(--done)" />
      <rect x="13.5" y="1" width="5.5" height="5.5" rx="1.5" fill="var(--done)" />
      <rect x="13.5" y="8" width="5.5" height="11" rx="1.5" fill="var(--partial)" />
      <rect x="1" y="13.5" width="11" height="5.5" rx="1.5" fill="var(--done)" />
    </svg>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession().catch(() => null);
  const name = config().SITE_NAME;
  const discord = config().SITE_DISCORD_URL.trim();
  const navLink = "rounded-lg px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink";
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} style={{ colorScheme: "dark" }}>
      <body className="min-h-screen font-sans antialiased">
        <JsonLd data={siteJsonLd()} />
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4">
            <Link href="/" className="mr-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Mark />
              {name}
            </Link>
            <Link href="/" className={`${navLink} hidden sm:block`}>
              Projects
            </Link>
            <Link href="/docs" className={navLink}>
              Docs
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {discord ? (
                <a
                  href={discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${navLink} flex items-center gap-1.5`}
                  aria-label={`${name} Discord`}
                >
                  <Chat size={15} />
                  <span className="hidden md:inline">Discord</span>
                </a>
              ) : null}
              {session ? (
                <>
                  <Link href="/manage" className={navLink}>
                    Manage
                  </Link>
                  <span className="mx-1 hidden items-center gap-2 text-sm text-ink-3 md:flex">
                    {session.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a 20px avatar from GitHub
                      <img src={`${session.user.avatarUrl}&s=40`} alt="" width={20} height={20} className="rounded-full" />
                    ) : null}
                    {session.user.login}
                  </span>
                  <form action="/auth/logout" method="post">
                    <button className={navLink}>Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/manage/new" className={`${navLink} hidden sm:block`}>
                    Submit a project
                  </Link>
                  <Link href="/login" className="btn btn-ghost ml-1 h-8 px-3">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-xs text-ink-3">
            <span>
              {name} tracks matching decompilation progress from{" "}
              <a className="underline hover:text-ink" href="https://github.com/encounter/objdiff">
                objdiff
              </a>{" "}
              reports.
            </span>
            <Link href="/docs" className="hover:text-ink">
              Docs
            </Link>
            <Link href="/docs/migrating-from-decomp-dev" className="hover:text-ink">
              Coming from decomp.dev?
            </Link>
            {discord ? (
              <a href={discord} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                Discord
              </a>
            ) : null}
            <a href="https://github.com/Veradictus/ByteMatch" className="hover:text-ink sm:ml-auto">
              Source (GPL-3.0)
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
