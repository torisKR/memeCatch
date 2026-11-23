#!/usr/bin/env node
// Rewrites src/routes/search/curated.json: the curated memes of
// lib/curated-memes.ts as `curatedSearchCards` sees them. For each: the five
// fields a reference carries, the text a query is looked for in (title,
// summary, slug and tags, NFC, lower-cased for ko-KR, as
// `curatedMemesMatchingQuery` builds it) and whether `isThinMeme` lets it
// be listed. Run it after a change to the curated memes:
//
//   node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/curated-search-catalog.mjs > server/src/routes/search/curated.json
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const { CURATED_CORE_MEMES, curatedDepthInput } = await import(path.join(ROOT, "lib/curated-memes.ts"));
const { isThinMeme } = await import(path.join(ROOT, "lib/thin-meme.ts"));

const catalog = CURATED_CORE_MEMES.map((meme) => ({
  id: meme.id,
  short_id: meme.short_id,
  slug: meme.slug,
  title: meme.title,
  summary: meme.summary,
  haystack: [meme.title, meme.summary, meme.slug, ...meme.tags].join("\n").normalize("NFC").toLocaleLowerCase("ko-KR"),
  listed: !isThinMeme(curatedDepthInput(meme)),
}));
process.stdout.write(`${JSON.stringify(catalog, null, 1)}\n`);
