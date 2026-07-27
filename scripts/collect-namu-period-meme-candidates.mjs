#!/usr/bin/env node
/**
 * Discover Korean period memes and challenges from the public namu.wiki
 * "밈(인터넷 용어)/시기별" article, then drop anything already present in the
 * local catalog (verified + raw) by memeTitleKey(title|aliases).
 *
 * Output is review-only discovery JSONL. It never writes to Supabase.
 *
 * Usage:
 *   node scripts/collect-namu-period-meme-candidates.mjs \
 *     data/memes/collected/.work/namu-period-memes.md \
 *     data/memes/verified,data/memes/raw \
 *     data/memes/collected/namu-period-new-memes-2010-2026.jsonl \
 *     --years=2010-2026
 *
 * Or scrape first:
 *   firecrawl scrape "https://namu.wiki/w/밈(인터넷 용어)/시기별" -o path.md
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { memeTitleKey } from "./meme-title-key.mjs";

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

function isFootnoteLabel(title) {
  return /^\\?\[\d+\\?\]$/.test(title) || /^\d+$/.test(title) || /^편집$/.test(title);
}

function isNavigationTitle(title) {
  return (
    /^(?:나무위키|최근|편집|토론|역사|분류|상위|관련|검색|이동|대한민국|해외|일본|인터넷 밈|문제점|기타|시기별)$/.test(
      title,
    ) ||
    title.startsWith("밈(인터넷 용어)") ||
    title.startsWith("분류:") ||
    /^1\.\d/.test(title)
  );
}

function categoryHint(title) {
  if (/챌린지|challenge/i.test(title)) return "challenge";
  if (/댄스|춤|dance/i.test(title)) return "dance";
  if (/송|노래|뮤직|music|song/i.test(title)) return "song";
  return "phrase";
}

/**
 * Parse only the Korea (대한민국) timeline body until the overseas section.
 * Supports both `- 2010년` blocks and `#### 1.1.x. 2018년` headings.
 */
export function parseNamuKoreaPeriodMemes(markdown, { minYear = 2010, maxYear = 2026 } = {}) {
  const text = String(markdown ?? "");
  const koreaStart = text.search(/무대뽀|헝그리 정신|느그 아부지/);
  const overseasStart = text.search(/\n###\s*\[1\.2\.\][^\n]*해외/);
  const korea =
    koreaStart >= 0
      ? text.slice(koreaStart, overseasStart >= 0 ? overseasStart : undefined)
      : text;

  let year = null;
  const rows = [];
  const seen = new Set();

  for (const rawLine of korea.split(/\n/)) {
    const line = rawLine.trim();
    const headingYear =
      line.match(/^- (20(?:0\d|1\d|2[0-6]))년\s*$/)?.[1] ??
      line.match(/^#{2,4}\s+.*?\b(20(?:0\d|1\d|2[0-6]))년/)?.[1] ??
      null;
    if (headingYear) {
      year = Number(headingYear);
      continue;
    }
    if (!Number.isInteger(year) || year < minYear || year > maxYear) continue;

    for (const match of line.matchAll(/\[([^\]]+)\]\((https:\/\/namu\.wiki\/w\/[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const title = match[1].trim();
      const sourceUrl = match[2].split("#")[0];
      if (!title || isFootnoteLabel(title) || isNavigationTitle(title)) continue;
      const key = memeTitleKey(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        title,
        origin_year: year,
        source_url: sourceUrl,
        category_hint: categoryHint(title),
      });
    }
  }

  return rows.sort((a, b) => a.origin_year - b.origin_year || a.title.localeCompare(b.title, "ko"));
}

function parseYearRange(value) {
  if (value.includes("-")) {
    const [start, end] = value.split("-").map(Number);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      throw new Error(`invalid --years range: ${value}`);
    }
    return { min: start, max: end };
  }
  const years = value
    .split(",")
    .map(Number)
    .filter((year) => Number.isInteger(year));
  if (!years.length) throw new Error(`invalid --years: ${value}`);
  return { min: Math.min(...years), max: Math.max(...years), set: new Set(years) };
}

async function main() {
  const [markdownPath, catalogPaths, outputPath, ...args] = process.argv.slice(2);
  const yearsArg = args.find((arg) => arg.startsWith("--years="))?.slice(8) ?? "2010-2026";

  if (!markdownPath || !catalogPaths || !outputPath) {
    console.error(
      "usage: node scripts/collect-namu-period-meme-candidates.mjs <namu-period.md> <catalog-dirs-csv> <output.jsonl> [--years=2010-2026]",
    );
    process.exitCode = 2;
    return;
  }

  const yearRange = parseYearRange(yearsArg);
  const yearAllowed = (year) => (yearRange.set ? yearRange.set.has(year) : year >= yearRange.min && year <= yearRange.max);

  const catalogKeys = loadCatalogKeys(catalogPaths);
  const markdown = readFileSync(resolve(markdownPath), "utf8");
  const parsed = parseNamuKoreaPeriodMemes(markdown, {
    minYear: yearRange.min,
    maxYear: yearRange.max,
  }).filter((row) => yearAllowed(row.origin_year));

  const candidates = [];
  let duplicates = 0;
  for (const row of parsed) {
    const key = memeTitleKey(row.title);
    if (catalogKeys.has(key)) {
      duplicates += 1;
      continue;
    }
    candidates.push({
      title: row.title,
      aliases: [],
      origin_year: row.origin_year,
      locale: "ko",
      category_hint: row.category_hint,
      candidate_source: "namu.wiki 밈(인터넷 용어)/시기별",
      source_url: row.source_url,
      catalog_match_status: "new",
      review_status: "needs_human_source_match",
      collection_note:
        "New Korean period-meme discovery only. Deduped against local verified/raw titles. Confirm distinctness, safety, and a direct social original before publishing.",
    });
    catalogKeys.add(key);
  }

  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(
    resolve(outputPath),
    `${candidates.map((row) => JSON.stringify(row)).join("\n")}${candidates.length ? "\n" : ""}`,
  );

  const byYear = {};
  const byCategory = {};
  for (const row of candidates) {
    byYear[row.origin_year] = (byYear[row.origin_year] ?? 0) + 1;
    byCategory[row.category_hint] = (byCategory[row.category_hint] ?? 0) + 1;
  }
  process.stderr.write(
    `${JSON.stringify({
      parsed: parsed.length,
      duplicates_skipped: duplicates,
      new_candidates: candidates.length,
      challenges: byCategory.challenge ?? 0,
      by_year: byYear,
      by_category: byCategory,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
