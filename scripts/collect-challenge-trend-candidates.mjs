#!/usr/bin/env node
/**
 * Merge public challenge/trend discovery snippets into new meme title
 * candidates, deduped against the local catalog and against each other.
 *
 * Accepts Firecrawl/search markdown/json text files and extracts candidate
 * titles from patterns like "○○ 챌린지", then keeps only titles not already
 * in verified/raw.
 *
 * Usage:
 *   node scripts/collect-challenge-trend-candidates.mjs \
 *     data/memes/collected/.work \
 *     data/memes/verified,data/memes/raw \
 *     data/memes/collected/challenge-trend-new-memes-2010-2026.jsonl \
 *     --years=2010-2026
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { memeTitleKey } from "./meme-title-key.mjs";

const TITLE_PATTERN =
  /(?:^|[^\w가-힣])((?:[A-Za-z0-9()（）\[\]"'“”‘’·.\-–—/\s가-힣]{1,40}?)(?:\s*)(?:챌린지|challenge))(?=$|[^\w가-힣])/giu;

function jsonlFiles(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return extname(absolute) === ".jsonl" ? [absolute] : [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return jsonlFiles(entryPath);
    return extname(entry.name) === ".jsonl" ? [entryPath] : [];
  });
}

function loadCatalogKeys(csvPaths) {
  const keys = new Set();
  for (const path of csvPaths.split(",").map((part) => part.trim()).filter(Boolean)) {
    for (const file of jsonlFiles(path)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          for (const name of [row.title, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
            const key = memeTitleKey(name);
            if (key) keys.add(key);
          }
        } catch {
          // Ignore malformed catalog rows.
        }
      }
    }
  }
  return keys;
}

function cleanTitle(value) {
  return String(value ?? "")
    .replace(/^[#\s\-–—*•·\d.:|]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

function isNoisyChallengeTitle(title) {
  const value = title.toLowerCase();
  if (title.length < 5 || title.length > 40) return true;
  if (/https?:|www\.|youtube|tiktok\.com|instagram|shorts\/|video\/|cafe\.|namu\.wiki/i.test(title)) return true;
  if (/\.\.\.|…/.test(title)) return true;
  if (/인기|유행|모음|총정리|결산|목록|소개|핫한|요즘|가장/.test(title)) return true;
  if (/^(?:틱톡|인스타|릴스|유튜브|shorts|tiktok|instagram|dance)\s*챌린지$/i.test(title)) return true;
  if (/^\d{4}\s*년/.test(title)) return true;
  if (/행사|공식|주관/.test(title)) return true;
  // Require a concrete headword before 챌린지 (not just "댄스 챌린지").
  if (/^(?:댄스|춤|노래|음악|틱톡|릴스)\s*챌린지$/i.test(title)) return true;
  return false;
}

function yearFromContext(text, index) {
  const window = text.slice(Math.max(0, index - 80), index + 80);
  const match = window.match(/\b(20(?:1\d|2[0-6]))\b/);
  return match ? Number(match[1]) : null;
}

function extractChallengeTitles(text, discoveryFile) {
  const rows = [];
  for (const match of String(text).matchAll(TITLE_PATTERN)) {
    const title = cleanTitle(match[1]);
    if (!title || isNoisyChallengeTitle(title)) continue;
    rows.push({
      title,
      origin_year: yearFromContext(text, match.index ?? 0),
      discovery_file: discoveryFile,
    });
  }
  return rows;
}

function parseYearRange(value) {
  if (value.includes("-")) {
    const [start, end] = value.split("-").map(Number);
    return { min: start, max: end };
  }
  const years = value.split(",").map(Number).filter((year) => Number.isInteger(year));
  return { min: Math.min(...years), max: Math.max(...years), set: new Set(years) };
}

async function main() {
  const [discoveryDir, catalogPaths, outputPath, ...args] = process.argv.slice(2);
  const yearsArg = args.find((arg) => arg.startsWith("--years="))?.slice(8) ?? "2010-2026";
  if (!discoveryDir || !catalogPaths || !outputPath) {
    console.error(
      "usage: node scripts/collect-challenge-trend-candidates.mjs <discovery-dir> <catalog-dirs-csv> <output.jsonl> [--years=2010-2026]",
    );
    process.exitCode = 2;
    return;
  }

  const yearRange = parseYearRange(yearsArg);
  const catalogKeys = loadCatalogKeys(catalogPaths);
  const root = resolve(discoveryDir);
  const files = readdirSync(root).filter((name) => /\.(md|json|txt)$/i.test(name));
  const discovered = [];
  for (const name of files) {
    discovered.push(...extractChallengeTitles(readFileSync(join(root, name), "utf8"), name));
  }

  const candidates = [];
  let duplicates = 0;
  let undated = 0;
  for (const row of discovered) {
    const key = memeTitleKey(row.title);
    if (!key) continue;
    if (catalogKeys.has(key)) {
      duplicates += 1;
      continue;
    }
    let year = row.origin_year;
    if (!Number.isInteger(year) || year < yearRange.min || year > yearRange.max) {
      // Keep undated challenge discoveries as 0-year null for review triage.
      year = null;
      undated += 1;
    } else if (yearRange.set && !yearRange.set.has(year)) {
      continue;
    }
    catalogKeys.add(key);
    candidates.push({
      title: row.title,
      aliases: [],
      origin_year: year,
      locale: "ko",
      category_hint: "challenge",
      candidate_source: "public challenge/trend discovery",
      source_url: null,
      discovery_file: row.discovery_file,
      catalog_match_status: "new",
      review_status: "needs_human_source_match",
      collection_note:
        "Challenge/trend title discovered from public web snippets. Deduped against local catalog. Confirm year, distinctness, and a direct social original before publishing.",
    });
  }

  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(
    resolve(outputPath),
    `${candidates.map((row) => JSON.stringify(row)).join("\n")}${candidates.length ? "\n" : ""}`,
  );
  process.stderr.write(
    `${JSON.stringify({
      files: files.length,
      extracted: discovered.length,
      duplicates_skipped: duplicates,
      undated,
      new_candidates: candidates.length,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
