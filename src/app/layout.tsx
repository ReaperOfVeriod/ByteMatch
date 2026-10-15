import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";
import { currentSession } from "@/auth/session";
import { InlineScript } from "@/components/inline-script";
import { JsonLd } from "@/components/json-ld";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemePicker } from "@/components/theme-picker";
import { Chat } from "@/components/ui/icons";
import { siteJsonLd, siteMetadata } from "@/lib/seo";
import { config } from "@/lib/config";
import { BOOT_SCRIPT } from "@/lib/theme";
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
    // The <head> script writes the chosen theme onto <html> before first paint, so React must
    // accept that inline style rather than reset it.
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <InlineScript html={BOOT_SCRIPT} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <JsonLd data={siteJsonLd()} />
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4">
            <Link href="/" className="mr-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Mark />
              {name}
            </Link>
            <div className="hidden items-center gap-1 md:flex">
              <Link href="/" className={navLink}>
                Projects
              </Link>
              <Link href="/games" className={navLink}>
                Games
              </Link>
              <Link href="/activity" className={navLink}>
                Activity
              </Link>
              <Link href="/docs" className={navLink}>
                Docs
              </Link>
            </div>
            <div className="ml-auto hidden items-center gap-1 md:flex">
              {discord ? (
                <a href={discord} target="_blank" rel="noopener noreferrer" className={`${navLink} flex items-center gap-1.5`}>
                  <Chat size={15} />
                  Discord
                </a>
              ) : null}
              {session ? (
                <>
                  <Link href="/manage" className={navLink}>
                    Manage
                  </Link>
                  {session.admin ? (
                    <Link href="/admin" className={navLink}>
                      Admin
                    </Link>
                  ) : null}
                  <ThemePicker />
                  <span className="mx-1 hidden items-center gap-2 text-sm text-ink-3 lg:flex">
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
                  <Link href="/manage/new" className={navLink}>
                    Submit a project
                  </Link>
                  <ThemePicker />
                  <Link href="/login" className="btn btn-ghost ml-1 h-8 px-3">
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2 md:hidden">
              <ThemePicker />
              {session ? null : (
                <Link href="/login" className="btn btn-ghost h-9 px-3">
                  Sign in
                </Link>
              )}
              <MobileMenu
                user={session?.user.login ?? null}
                signOut={!!session}
                links={[
                  { href: "/", label: "Projects" },
                  { href: "/games", label: "Games" },
                  { href: "/activity", label: "Activity" },
                  { href: "/docs", label: "Docs" },
                  { href: "/manage/new", label: "Submit a project" },
                  ...(session ? [{ href: "/manage", label: "Manage" }] : []),
                  ...(session?.admin ? [{ href: "/admin", label: "Admin" }] : []),
                  ...(discord ? [{ href: discord, label: "Discord", external: true }] : []),
                ]}
              />
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
