#!/usr/bin/env node
/**
 * Collect review-only global meme title candidates from Wikimedia's public
 * category API. This is a discovery dataset, not a publishable import: every
 * candidate needs title de-duplication, locale review, and a direct source
 * before becoming a CatchMeme record.
 *
 * Usage:
 *   node scripts/collect-wikimedia-meme-candidates.mjs output.jsonl --years=2000,2001
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [outputPath, ...args] = process.argv.slice(2);
const yearsArg = args.find((arg) => arg.startsWith("--years="));
const requestedYears = (yearsArg?.slice(8) ?? "")
  .split(",")
  .filter(Boolean)
  .map(Number)
  .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2020);

if (!outputPath || requestedYears.length === 0) {
  console.error("usage: node scripts/collect-wikimedia-meme-candidates.mjs <output.jsonl> --years=2000,2001");
  process.exit(2);
}

const uniqueYears = [...new Set(requestedYears)].sort((a, b) => a - b);

async function sleep(milliseconds) {
  await new Promise((done) => setTimeout(done, milliseconds));
}

async function categoryMembers(year) {
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:Internet_memes_introduced_in_${year}`,
    cmnamespace: "0",
    cmlimit: "500",
    format: "json",
  }).toString();
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "CatchMemeCandidateCollector/1.0 (https://catchmeme.com; contact@catchmeme.com)",
      "accept-language": "en",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || !("query" in data)) {
    throw new Error(`Wikimedia category HTTP ${response.status}`);
  }
  const members = data.query?.categorymembers;
  return Array.isArray(members)
    ? members.filter((member) => typeof member?.title === "string").map((member) => member.title)
    : [];
}

const candidates = [];
const errors = [];
const seen = new Set();
for (const [index, year] of uniqueYears.entries()) {
  try {
    const titles = await categoryMembers(year);
    for (const title of titles) {
      const key = title.normalize("NFKC").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        title,
        origin_year: year,
        locale: "en",
        candidate_source: "Wikimedia Category: Internet memes introduced in year",
        source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        review_status: "needs_human_source_match",
        collection_note: "Discovery candidate only. Verify that the title is a distinct meme, check locale suitability, and add a direct original source before publishing.",
      });
    }
    process.stderr.write(`collected ${index + 1}/${uniqueYears.length}: ${year}\n`);
  } catch (error) {
    errors.push({ year, message: error instanceof Error ? error.message : String(error) });
    process.stderr.write(`failed ${index + 1}/${uniqueYears.length}: ${year}\n`);
  }
  if (index < uniqueYears.length - 1) await sleep(2_000);
}

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${candidates.map((row) => JSON.stringify(row)).join("\n")}\n`);
if (errors.length) writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
process.stderr.write(`${JSON.stringify({ years: uniqueYears.length, candidates: candidates.length, errors: errors.length })}\n`);
