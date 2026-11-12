import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isIndexableMeme } from "@/lib/content-depth";
import { CURATED_CORE_MEMES, curatedDepthInput } from "@/lib/curated-memes";
import { isThinMeme } from "@/lib/thin-meme";

type SeedMeme = {
  id: string;
  shortId: string;
  slug: string;
  description: string;
  origin: string;
  usageNote: string | null;
  caution: string | null;
  usageExamples: unknown;
  sourceCount: number;
};

function unquote(value: string): string | null {
  if (value === "null") return null;
  return value.slice(1, -1).replaceAll("''", "'");
}

function parseSeed(sql: string): SeedMeme[] {
  const insert = sql.slice(sql.indexOf(") values"), sql.indexOf("insert into meme_sources"));
  const rows: SeedMeme[] = [];
  const tuple = /\(\s*'([0-9a-f-]{36})',\s*'(devseed\d+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*array\[[^\]]*],\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'\{[^}]*\}'::jsonb,\s*(null|'(?:[^']|'')*'),\s*(null|'(?:[^']|'')*'),/g;
  for (const match of insert.matchAll(tuple)) {
    rows.push({
      id: match[1],
      shortId: match[2],
      slug: match[4],
      description: unquote(`'${match[6]}'`) ?? "",
      origin: unquote(`'${match[7]}'`) ?? "",
      usageNote: unquote(match[8]),
      caution: unquote(match[9]),
      usageExamples: [],
      sourceCount: 0,
    });
  }

  for (const row of rows) {
    const where = `'::jsonb where id = '${row.id}'`;
    const at = sql.indexOf(where);
    if (at >= 0) {
      const start = sql.lastIndexOf("[", at);
      row.usageExamples = JSON.parse(sql.slice(start, at));
    }
    const sources = sql.slice(
      sql.indexOf("insert into meme_sources"),
      sql.indexOf("update memes set usage_examples"),
    );
    row.sourceCount = [...sources.matchAll(new RegExp(`'${row.id}'`, "g"))].length;
  }
  return rows;
}

describe("thin catalog inventory", () => {
  it("classifies every seed and curated meme with the shared predicate", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");
    const seed = parseSeed(sql).map((row) => {
      const meme = {
        description: row.description,
        origin: row.origin,
        usage_note: row.usageNote,
        caution: row.caution,
        usage_examples: row.usageExamples,
        meme_sources: Array.from({ length: row.sourceCount }, () => ({
          source_url: "https://example.com/source",
        })),
        meme_contents: [],
        meme_tags_map: [],
      };
      return {
        slug: row.slug,
        shortId: row.shortId,
        thin: isThinMeme(meme),
        indexable: isIndexableMeme(meme),
      };
    });
    const curated = CURATED_CORE_MEMES.map((meme) => ({
      slug: meme.slug,
      shortId: meme.short_id,
      thin: isThinMeme(curatedDepthInput(meme)),
      indexable: isIndexableMeme(curatedDepthInput(meme)),
    }));

    expect(seed).toHaveLength(12);
    expect(curated.length).toBe(CURATED_CORE_MEMES.length);
    const thin = [...seed, ...curated].filter((row) => row.thin);
    const indexable = [...seed, ...curated].filter((row) => !row.thin);
    console.log(JSON.stringify({
      seed: seed.length,
      curated: curated.length,
      thin: thin.length,
      indexable: indexable.length,
      thinSlugs: thin.map((row) => row.slug),
      rows: [...seed, ...curated],
    }));
    expect(thin.length + indexable.length).toBe(seed.length + curated.length);
  });
});
