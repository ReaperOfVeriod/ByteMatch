/**
 * Games and franchises are not stored on their own: each project names the game it decompiles and
 * the franchise it belongs to, and projects naming the same game (by slug, so "Ratchet & Clank"
 * and "ratchet and clank" agree) share one game page. Pure, so pages and tests share it.
 */

/** "Ratchet & Clank: Going Commando" → "ratchet-and-clank-going-commando". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** A game or franchise name as typed: trimmed, inner whitespace collapsed, at most 100 characters. */
export function cleanName(input: string | null | undefined): string | null {
  const v = (input ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  return v && slugify(v) ? v : null;
}

/** A plausible release year, or null. */
export function cleanYear(input: string | number | null | undefined): number | null {
  const y = Number(String(input ?? "").trim());
  return Number.isInteger(y) && y >= 1970 && y <= new Date().getFullYear() + 2 ? y : null;
}

export interface GameProject {
  game: string | null;
  franchise: string | null;
  releaseYear: number | null;
  platform: string | null;
}

export interface Game<P extends GameProject> {
  slug: string;
  title: string;
  franchise: string | null;
  franchiseSlug: string | null;
  year: number | null;
  platforms: string[];
  projects: P[];
}

export interface Franchise<P extends GameProject> {
  slug: string;
  title: string;
  games: Game<P>[];
}

/** The value most projects agree on (ties: the first one listed). */
function consensus<T>(values: (T | null)[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let most = 0;
  for (const [v, n] of counts)
    if (n > most) {
      best = v;
      most = n;
    }
  return best;
}

/** Groups projects into games; projects without a game are left out. Sorted by year, then title. */
export function groupGames<P extends GameProject>(projects: P[]): Game<P>[] {
  const bySlug = new Map<string, P[]>();
  for (const p of projects) {
    const slug = p.game ? slugify(p.game) : "";
    if (!slug) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), p]);
  }
  return [...bySlug]
    .map(([slug, list]) => {
      const franchise = consensus(list.map((p) => cleanName(p.franchise)));
      return {
        slug,
        title: consensus(list.map((p) => cleanName(p.game)))!,
        franchise,
        franchiseSlug: franchise ? slugify(franchise) : null,
        year: consensus(list.map((p) => p.releaseYear)),
        platforms: [...new Set(list.map((p) => p.platform?.toLowerCase()).filter((x): x is string => !!x))].sort(),
        projects: list,
      };
    })
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
}

/** Groups games into franchises; games without one are left out. Sorted by title. */
export function groupFranchises<P extends GameProject>(games: Game<P>[]): Franchise<P>[] {
  const bySlug = new Map<string, Game<P>[]>();
  for (const g of games) if (g.franchiseSlug) bySlug.set(g.franchiseSlug, [...(bySlug.get(g.franchiseSlug) ?? []), g]);
  return [...bySlug]
    .map(([slug, list]) => ({ slug, title: consensus(list.map((g) => g.franchise))!, games: list }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
