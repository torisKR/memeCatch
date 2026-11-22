import { describe, expect, it } from "vitest";
import {
  directoryNeighbours,
  directoryPage,
  directoryPageCount,
  directoryPagePath,
  isDirectoryMeme,
  parseDirectoryPage,
  sortDirectory,
  type MemeDirectoryItem,
} from "@/lib/meme-directory";
import { CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";

const rich = {
  description: "밈".repeat(339),
  origin: "밈".repeat(60),
  meme_sources: [{ source_url: "https://example.com/source" }],
  meme_contents: [],
  meme_tags_map: [],
};

function item(id: string, title: string, category = "phrase", year: number | null = 2020): MemeDirectoryItem {
  return { id, short_id: id, slug: id, title, summary: "", category, origin_year: year };
}

describe("meme directory", () => {
  it("lists only what the sitemap lists: discovery, not thin, not an alias", () => {
    const ids = new Set(["a", "alias"]);
    expect(isDirectoryMeme({ id: "a", short_id: "a1", slug: "x", ...rich }, ids)).toBe(true);
    expect(isDirectoryMeme({ id: "b", short_id: "b1", slug: "x", ...rich }, ids)).toBe(false);
    expect(isDirectoryMeme({ id: "a", short_id: "a1", slug: "x", ...rich, description: "짧음", origin: null }, ids)).toBe(false);
    const aliasShortId = Object.keys(CANONICAL_MEME_ALIAS_MAP)[0];
    if (aliasShortId) {
      expect(isDirectoryMeme({ id: "alias", short_id: aliasShortId, slug: "x", ...rich }, ids)).toBe(false);
    }
  });

  it("sorts in Korean dictionary order with a stable tiebreak", () => {
    const sorted = sortDirectory([item("3", "하이"), item("1", "가나"), item("2", "나비"), item("0", "가나")]);
    expect(sorted.map((m) => m.id)).toEqual(["0", "1", "2", "3"]);
  });

  it("paginates 100 per page with /memes as page 1", () => {
    expect(directoryPageCount(0)).toBe(1);
    expect(directoryPageCount(100)).toBe(1);
    expect(directoryPageCount(101)).toBe(2);
    expect(directoryPagePath(1)).toBe("/memes");
    expect(directoryPagePath(4)).toBe("/memes?page=4");
    const list = Array.from({ length: 205 }, (_, i) => i);
    expect(directoryPage(list, 3)).toEqual({ items: [200, 201, 202, 203, 204], page: 3, pageCount: 3 });
    expect(directoryPage(list, 4)).toBeNull();
  });

  it.each([
    [undefined, 1], ["1", 1], ["12", 12],
    ["0", null], ["-1", null], ["2.5", null], ["02", null], ["abc", null], [["2", "3"], null],
  ] as const)("parses ?page=%j as %j", (raw, expected) => {
    expect(parseDirectoryPage(raw as string | string[] | undefined)).toBe(expected);
  });

  it("picks same-category and same-year neighbours without repeats or the meme itself", () => {
    const items = [
      item("self", "자기", "phrase", 2020),
      item("c1", "가", "phrase", 2019),
      item("c2", "나", "phrase", 2018),
      item("y1", "다", "song", 2020),
      item("both", "라", "phrase", 2020),
      item("other", "마", "song", 2010),
      item("related", "바", "phrase", 2020),
    ];
    const { sameCategory, sameYear } = directoryNeighbours(
      items,
      { id: "self", category: "phrase", origin_year: 2020 },
      { exclude: new Set(["related"]), limit: 8 },
    );
    const catIds = sameCategory.map((m) => m.id).sort();
    expect(catIds).toEqual(["both", "c1", "c2"]);
    expect(sameYear.map((m) => m.id)).toEqual(["y1"]);
    expect(directoryNeighbours(items, { id: "self", category: "phrase", origin_year: null }).sameYear).toEqual([]);
  });
});
