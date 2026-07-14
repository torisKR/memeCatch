#!/usr/bin/env node
/**
 * Collect a small, reviewed seed set from Wikimedia's public "Viral videos"
 * category. These pages supplement the year-specific Internet-meme categories
 * when a notable viral video was not assigned to that category.
 *
 * The result is discovery data only. A Wikipedia page proves the candidate
 * exists; it does not prove the linked page is the original upload. Every row
 * remains review-only until an editor verifies a primary source.
 *
 * Usage:
 *   node scripts/collect-wikimedia-viral-video-candidates.mjs output.jsonl
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = process.argv[2];
if (!outputPath) {
  console.error("usage: node scripts/collect-wikimedia-viral-video-candidates.mjs <output.jsonl>");
  process.exit(2);
}

// Years are publication/viral-breakout years recorded for editorial review.
// Keep this deliberately small and explicit rather than inferring dates from
// search snippets; a reviewer must still validate the actual original upload.
const SEEDS = [
  ["Red vs. Blue", 2003],
  ["They're Taking the Hobbits to Isengard", 2005],
  ["Cooking by the Book", 2006],
  ["The Bus Uncle", 2006],
  ["Deltalina", 2007],
  ["Diary of a Bad Man", 2007],
  ["BME Pain Olympics", 2007],
  ["Moymoy Palaboy", 2007],
  ["Nostalgia Critic", 2007],
  ["The Great Schlep", 2008],
  ["Songify the News", 2009],
  ["Red Letter Media", 2009],
  ["Marcel the Shell with Shoes On (short film series)", 2010],
  ["Sonseed", 2011],
  ["Chuck Testa", 2011],
  ["The Force (advertisement)", 2011],
  ["Butt Fumble", 2012],
  ["Prancercise", 2012],
  ["Pepsi Max & Jeff Gordon Present: Test Drive", 2012],
  ["Good Mythical Morning", 2012],
  ["Dove Real Beauty Sketches", 2013],
  ["Going to the Store", 2013],
  ["To This Day", 2013],
  ["Viking Row", 2013],
  ["Milly Rock", 2014],
  ["FCKH8: Drop F-Bombs for Feminism", 2014],
  ["Turn Down for What", 2014],
  ["Selfie (song)", 2014],
  ["The Software Devloveper", 2014],
  ["Primitive Technology", 2015],
  ["Spirits (The Strumbellas song)", 2015],
  ["Merry-go-round of death", 2016],
  ["Man's Not Hot", 2017],
  ["Silhouette Challenge", 2020],
  ["Kutti Story", 2020],
];

if (SEEDS.some(([, year]) => year < 2000 || year > 2020)) {
  throw new Error("all viral-video candidates must be in the requested 2000–2020 range");
}

const endpoint = new URL("https://en.wikipedia.org/w/api.php");
endpoint.search = new URLSearchParams({
  action: "query",
  titles: SEEDS.map(([title]) => title).join("|"),
  format: "json",
}).toString();

const response = await fetch(endpoint, {
  headers: {
    "user-agent": "CatchMemeCandidateCollector/1.0 (https://catchmeme.com; contact@catchmeme.com)",
    "accept-language": "en",
  },
  signal: AbortSignal.timeout(20_000),
});
const data = await response.json().catch(() => null);
if (!response.ok || !data || typeof data !== "object" || !("query" in data)) {
  throw new Error(`Wikimedia page validation HTTP ${response.status}`);
}

const pages = data.query?.pages ?? {};
const available = new Set(
  Object.values(pages)
    .filter((page) => !page.missing && typeof page.title === "string")
    .map((page) => page.title)
);
const missing = SEEDS.map(([title]) => title).filter((title) => !available.has(title));
if (missing.length > 0) throw new Error(`Wikimedia pages not found: ${missing.join(", ")}`);

const rows = SEEDS.map(([title, originYear]) => ({
  title,
  origin_year: originYear,
  locale: "en",
  candidate_source: "Wikimedia Category: Viral videos",
  source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  review_status: "needs_human_source_match",
  collection_note:
    "Discovery candidate only. Verify the publication/viral-breakout year and add a direct original upload before publishing.",
}));

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
process.stderr.write(`${JSON.stringify({ candidates: rows.length, missing: missing.length })}\n`);
