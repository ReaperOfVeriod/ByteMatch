import { describe, expect, it } from "vitest";
import { filterAndSort, listQuery, paginate, pageWindow, parseListParams } from "./project-query";

const rows = [
  { owner: "OpenRAC", repo: "rac1-decomp", name: "Ratchet & Clank (PAL)", platform: "ps2", codePercent: 86, updated: "2026-10-14" },
  { owner: "OpenRAC", repo: "rac2-gc-decomp", name: "Going Commando", platform: "ps2", codePercent: 12, updated: "2026-10-15" },
  { owner: "zeldaret", repo: "tp", name: "Twilight Princess", platform: "gc", codePercent: 40, updated: "2026-10-01" },
  { owner: "x", repo: "new", name: "Fresh", platform: null, codePercent: null, updated: null },
];

describe("project list queries", () => {
  it("parses and sanitises URL parameters", () => {
    expect(parseListParams(new URLSearchParams("q= ratchet &platform=PS2&sort=progress&page=3"))).toEqual({
      q: "ratchet",
      platform: "ps2",
      sort: "progress",
      page: 3,
    });
    expect(parseListParams({ sort: "bogus", page: "-4" })).toEqual({ q: "", platform: "", sort: "updated", page: 1 });
  });

  it("searches every word, filters by platform and sorts", () => {
    expect(filterAndSort(rows, { q: "clank pal", platform: "", sort: "updated" }).map((r) => r.repo)).toEqual(["rac1-decomp"]);
    expect(filterAndSort(rows, { q: "openrac", platform: "", sort: "updated" }).map((r) => r.repo)).toEqual([
      "rac2-gc-decomp",
      "rac1-decomp",
    ]);
    expect(filterAndSort(rows, { q: "", platform: "ps2", sort: "progress" }).map((r) => r.repo)).toEqual(["rac1-decomp", "rac2-gc-decomp"]);
    expect(filterAndSort(rows, { q: "", platform: "", sort: "progress" }).at(-1)?.repo).toBe("new");
  });

  it("pages and clamps past the end", () => {
    const list = Array.from({ length: 50 }, (_, i) => i);
    expect(paginate(list, 2, 24)).toMatchObject({ items: list.slice(24, 48), total: 50, page: 2, pages: 3 });
    expect(paginate(list, 99, 24).page).toBe(3);
    expect(paginate([], 1, 24)).toMatchObject({ items: [], pages: 1, page: 1 });
  });

  it("builds short URLs and page windows", () => {
    expect(listQuery({ q: "zelda", sort: "updated", page: 1 })).toBe("?q=zelda");
    expect(listQuery({ platform: "gc", sort: "name", page: 2 })).toBe("?platform=gc&sort=name&page=2");
    expect(listQuery({})).toBe("");
    expect(pageWindow(6, 20)).toEqual([1, null, 4, 5, 6, 7, 8, null, 20]);
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
