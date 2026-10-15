import type { ProjectRow } from "@/components/project-list";
import { projectIndex } from "@/db/store";
import { groupFranchises, groupGames, type Game } from "./games";
import { platformName } from "./platforms";

export type GameRow = ProjectRow & {
  id: number;
  game: string | null;
  franchise: string | null;
  releaseYear: number | null;
  cover: string | null;
};

/** Public projects as list rows, with the game fields the games pages group on. */
export async function gameRows(): Promise<GameRow[]> {
  return (await projectIndex()).map((p) => ({
    id: p.id,
    owner: p.owner,
    repo: p.repo,
    name: p.name,
    platform: p.platform,
    platformName: platformName(p.platform),
    game: p.game,
    franchise: p.franchise,
    releaseYear: p.release_year,
    version: p.version,
    codePercent: p.measures ? Number(p.measures.matched_code_percent) : null,
    functions: p.measures ? { done: Number(p.measures.matched_functions), total: Number(p.measures.total_functions) } : null,
    updated: p.commit_timestamp ? new Date(p.commit_timestamp).toISOString() : null,
    gain30: p.gain_30d === null ? null : Number(p.gain_30d),
    createdAt: new Date(p.created_at).toISOString(),
    image: p.icon_url,
    cover: p.image_url,
  }));
}

export async function loadGames() {
  const rows = await gameRows();
  const games = groupGames(rows);
  return { games, franchises: groupFranchises(games), unassigned: rows.filter((r) => !r.game).length };
}

/** The game's furthest-along project first; projects still syncing last. */
export function byProgress(a: GameRow, b: GameRow) {
  return (b.codePercent ?? -1) - (a.codePercent ?? -1) || a.name.localeCompare(b.name);
}

/** The picture that stands for a game: the cover (else icon) of its furthest-along project that has one. */
export function gameArt(g: Game<GameRow>): { cover: string | null; icon: string | null } {
  const sorted = [...g.projects].sort(byProgress);
  return { cover: sorted.find((p) => p.cover)?.cover ?? null, icon: sorted.find((p) => p.image)?.image ?? null };
}

/** The highest code-matched percentage among the game's projects. */
export function bestPercent(g: Game<GameRow>): number | null {
  const v = g.projects.map((p) => p.codePercent).filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) : null;
}
