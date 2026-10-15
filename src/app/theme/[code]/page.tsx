import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StyleSwatch, ThemeSwatch } from "@/components/theme-swatch";
import { findSharedTheme } from "@/db/themes";
import { normalizeCode, SLOTS, STYLE_KEYS, STYLE_OPTIONS, STYLES, styleId } from "@/lib/theme";
import { UseSharedTheme } from "./use-shared";

export const dynamic = "force-dynamic";

type Params = Promise<{ code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const code = normalizeCode(decodeURIComponent((await params).code));
  const theme = code ? await findSharedTheme(code).catch(() => null) : null;
  return theme
    ? { title: `${theme.name} (theme)`, description: `A ByteMatch theme shared as ${code}.`, robots: { index: false } }
    : { title: "Theme not found", robots: { index: false } };
}

/** A shared theme, from its link: what it looks like, and one button to use it. */
export default async function SharedTheme({ params }: { params: Params }) {
  const raw = decodeURIComponent((await params).code);
  const code = normalizeCode(raw);
  if (!code) notFound();
  if (code !== raw) redirect(`/theme/${code}`);
  const theme = await findSharedTheme(code);
  if (!theme) notFound();
  const sid = styleId(theme.style);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div>
        <p className="text-sm text-ink-3">
          <Link href="/theme" className="hover:text-ink">
            Theme
          </Link>{" "}
          / shared
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{theme.name}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Someone shared this theme with you. Its code is <code className="rounded bg-code px-1.5 py-0.5 font-mono text-ink">{code}</code>.
        </p>
      </div>

      <section className="panel grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="What it looks like">
        <div>
          <div className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">Colours</div>
          <ThemeSwatch palette={theme.palette} className="aspect-[16/10] w-full" />
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
            {SLOTS.map(({ slot, label }) => (
              <span
                key={slot}
                title={`${label} ${theme.palette[slot]}`}
                className="size-5 rounded border border-line"
                style={{ background: theme.palette[slot] }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">Layout</div>
          <StyleSwatch style={theme.style} palette={theme.palette} className="aspect-[16/10] w-full" />
          <p className="mt-3 text-sm">{sid ? STYLES[sid].name : "Custom"}</p>
          <p className="text-xs text-ink-3">
            {STYLE_KEYS.map((k) => STYLE_OPTIONS[k].options.find((o) => o.value === theme.style[k])?.label).join(" · ")}
          </p>
        </div>
      </section>

      <UseSharedTheme theme={theme} />
    </div>
  );
}
