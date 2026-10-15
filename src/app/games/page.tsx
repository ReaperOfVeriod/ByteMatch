import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { loadGames } from "@/lib/game-data";
import { browseMetadata, gameListJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return browseMetadata(
    "Games",
    "Every game with a matching decompilation tracked here, grouped across its projects, regions and platforms.",
    "/games",
  );
}

export default async function Games() {
  const { games, franchises, unassigned } = await loadGames();
  return (
    <div>
      <JsonLd data={gameListJsonLd({ name: "Games with matching decompilations", path: "/games", games })} />
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Games</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Projects grouped by the game they decompile, so regional builds and parallel efforts sit together. Maintainers name the game on
          their project&apos;s manage page.
        </p>
      </div>

      {franchises.length ? (
        <section className="mb-8" aria-labelledby="franchises">
          <h2 id="franchises" className="mb-3 text-xs font-medium tracking-wide text-ink-3 uppercase">
            Franchises
          </h2>
          <ul className="flex flex-wrap gap-2">
            {franchises.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/franchises/${f.slug}`}
                  className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  {f.title}
                  <span className="text-xs text-ink-3">{f.games.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {games.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.slug} game={g} />
          ))}
        </ul>
      ) : (
        <p className="panel px-5 py-10 text-center text-sm text-ink-3">No project has named its game yet.</p>
      )}

      {unassigned ? (
        <p className="mt-6 text-xs text-ink-3">
          {unassigned} project{unassigned === 1 ? " hasn't" : "s haven't"} named a game yet;{" "}
          <Link href="/" className="text-accent hover:underline">
            all projects
          </Link>{" "}
          lists every one.
        </p>
      ) : null}
    </div>
  );
}
