import { describe, expect, it } from "vitest";
import { cleanName, cleanYear, groupFranchises, groupGames, slugify } from "./games";

const p = (game: string | null, franchise: string | null = null, releaseYear: number | null = null, platform: string | null = "ps2") => ({
  game,
  franchise,
  releaseYear,
  platform,
});

describe("games", () => {
  it("slugs names so spellings agree", () => {
    expect(slugify("Ratchet & Clank: Going Commando")).toBe("ratchet-and-clank-going-commando");
    expect(slugify("ratchet and clank   going commando")).toBe("ratchet-and-clank-going-commando");
    expect(slugify("Pokémon Colosseum")).toBe("pokemon-colosseum");
    expect(slugify("Kirby's Air Ride")).toBe("kirbys-air-ride");
    expect(slugify("!!!")).toBe("");
  });

  it("cleans names and years", () => {
    expect(cleanName("  Ratchet   &  Clank ")).toBe("Ratchet & Clank");
    expect(cleanName("  ")).toBeNull();
    expect(cleanName("???")).toBeNull();
    expect(cleanYear("2002")).toBe(2002);
    expect(cleanYear("02")).toBeNull();
    expect(cleanYear("")).toBeNull();
    expect(cleanYear(1900)).toBeNull();
  });

  it("groups projects into games by slug, with the majority's spelling", () => {
    const games = groupGames([
      p("Ratchet & Clank", "Ratchet & Clank", 2002),
      p("Ratchet and Clank", "Ratchet & Clank", 2002, "PS2"),
      p("Ratchet & Clank", null, 2002),
      p("Super Smash Bros. Melee", null, 2001, "gc"),
      p(null),
    ]);
    expect(games.map((g) => g.slug)).toEqual(["super-smash-bros-melee", "ratchet-and-clank"]);
    const rac = games[1];
    expect(rac.title).toBe("Ratchet & Clank");
    expect(rac.franchise).toBe("Ratchet & Clank");
    expect(rac.platforms).toEqual(["ps2"]);
    expect(rac.projects).toHaveLength(3);
  });

  it("groups games into franchises", () => {
    const games = groupGames([
      p("Going Commando", "Ratchet & Clank", 2003),
      p("Ratchet & Clank", "Ratchet and Clank", 2002),
      p("Melee", null, 2001),
    ]);
    const franchises = groupFranchises(games);
    expect(franchises).toHaveLength(1);
    expect(franchises[0].slug).toBe("ratchet-and-clank");
    expect(franchises[0].games.map((g) => g.title)).toEqual(["Ratchet & Clank", "Going Commando"]);
  });
});
