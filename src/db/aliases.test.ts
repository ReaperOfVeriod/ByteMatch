import { describe, expect, it } from "vitest";
import { TEST_DB, useTestDb } from "../../test/db";
import { gameKey, groupGames, resolveKey } from "../lib/games";
import { addAlias, AliasError, loadAliases, removeAlias } from "./aliases";

const p = (game: string) => ({ game, franchise: null, releaseYear: 2003, platform: "ps2" });

describe.skipIf(!TEST_DB)("name aliases", () => {
  useTestDb();

  it("groups a merged name with its target, and undoes it", async () => {
    await addAlias("game", "Ratchet & Clank 2", "Ratchet & Clank: Going Commando", null);
    const { games } = await loadAliases();
    expect(groupGames([p("Ratchet and Clank 2"), p("Ratchet & Clank: Going Commando")], { games })).toHaveLength(1);
    await removeAlias("game", gameKey("Ratchet & Clank 2"));
    const after = await loadAliases();
    expect(groupGames([p("Ratchet and Clank 2"), p("Ratchet & Clank: Going Commando")], { games: after.games })).toHaveLength(2);
  });

  it("moves names merged into a name along when that name is merged too", async () => {
    await addAlias("game", "R&C2", "Ratchet & Clank 2", null);
    await addAlias("game", "Ratchet & Clank 2", "Going Commando", null);
    const { games, rows } = await loadAliases();
    expect(resolveKey("R&C2", games)).toBe(gameKey("Going Commando"));
    expect(rows.find((r) => r.fromName === "R&C2")?.toName).toBe("Going Commando");
  });

  it("refuses merges into itself or in a circle", async () => {
    await expect(addAlias("game", "Ratchet & Clank", "Ratchet and Clank", null)).rejects.toBeInstanceOf(AliasError);
    await addAlias("game", "A Game", "B Game", null);
    await expect(addAlias("game", "B Game", "A Game", null)).rejects.toBeInstanceOf(AliasError);
  });

  it("keeps games and franchises apart", async () => {
    await addAlias("franchise", "R&C", "Ratchet & Clank", null);
    const { games, franchises } = await loadAliases();
    expect(games.size).toBe(0);
    expect(franchises.get(gameKey("R&C"))).toBe(gameKey("Ratchet & Clank"));
  });
});
