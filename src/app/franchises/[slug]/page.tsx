import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { ChevronRight } from "@/components/ui/icons";
import { loadGames } from "@/lib/game-data";
import { breadcrumbJsonLd, browseMetadata, gameListJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  return (await loadGames()).franchises.find((f) => f.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Params) {
  const f = await find((await params).slug);
  if (!f) return { title: "Franchise not found" };
  return browseMetadata(
    f.title,
    `Decompilation progress across the ${f.title} series: ${f.games.map((g) => g.title).join(", ")}.`,
    `/franchises/${f.slug}`,
  );
}

export default async function FranchisePage({ params }: Params) {
  const f = await find((await params).slug);
  if (!f) notFound();
  const projects = f.games.reduce((n, g) => n + g.projects.length, 0);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <JsonLd data={gameListJsonLd({ name: `${f.title} decompilations`, path: `/franchises/${f.slug}`, games: f.games })} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Games", path: "/games" },
          { name: f.title, path: `/franchises/${f.slug}` },
        ])}
      />
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/games" className="text-ink-3 hover:text-ink">
          Games
        </Link>
        <ChevronRight size={12} className="text-ink-3" />
        <span className="font-medium">{f.title}</span>
      </nav>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{f.title}</h1>
        <p className="mt-2 text-sm text-ink-2">
          {f.games.length} game{f.games.length === 1 ? "" : "s"} · {projects} project{projects === 1 ? "" : "s"}, in release order
        </p>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {f.games.map((g) => (
          <GameCard key={g.slug} game={g} showFranchise={false} />
        ))}
      </ul>
    </div>
  );
}
