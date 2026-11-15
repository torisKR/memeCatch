#!/usr/bin/env node
/**
 * Collect review-only Instagram source candidates without logging into Instagram
 * or scraping Instagram pages. Public web-search results provide final post
 * URLs; Instagram oEmbed then confirms that each URL is publicly embeddable.
 *
 * This never imports a row into Supabase or stores returned embed HTML. A human
 * must still confirm that each candidate is the actual meme source before it is
 * published as meme_contents or meme_sources.
 *
 * Usage:
 *   node scripts/collect-instagram-oembed-candidates.mjs data/memes/verified data/memes/collected/instagram-candidates.jsonl --max=20 --per-query=3
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { parseNativeSocialContent } from "./social-content.mjs";

const [inputPath, outputPath, ...args] = process.argv.slice(2);
const maxArg = args.find((arg) => arg.startsWith("--max="));
const perQueryArg = args.find((arg) => arg.startsWith("--per-query="));
const offsetArg = args.find((arg) => arg.startsWith("--offset="));
const yearsArg = args.find((arg) => arg.startsWith("--years="));
const maxPerYearArg = args.find((arg) => arg.startsWith("--max-per-year="));
const max = Math.max(1, Math.min(100, Number(maxArg?.slice(6) ?? 20)));
const perQuery = Math.max(1, Math.min(5, Number(perQueryArg?.slice(12) ?? 3)));
const offset = Math.max(0, Number(offsetArg?.slice(9) ?? 0));
const requestedYears = new Set(
  (yearsArg?.slice(8) ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2026)
);
const maxPerYear = maxPerYearArg ? Math.max(1, Math.min(50, Number(maxPerYearArg.slice(15)))) : null;

if (!inputPath || !outputPath) {
  console.error("usage: node scripts/collect-instagram-oembed-candidates.mjs <jsonl-file-or-directory> <output.jsonl> [--max=20] [--per-query=3]");
  process.exit(2);
}

function jsonlFiles(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) throw new Error(`input was not found: ${path}`);
  if (statSync(absolute).isFile()) return extname(absolute) === ".jsonl" ? [absolute] : [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return jsonlFiles(entryPath);
    return extname(entry.name) === ".jsonl" ? [entryPath] : [];
  });
}

function readMemes(path) {
  const seen = new Set();
  const rows = [];
  for (const file of jsonlFiles(path).sort()) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const title = String(row.title ?? "").trim();
        const year = Number(row.year);
        const key = title.replace(/\s+/g, "").toLowerCase();
        if (!title || !Number.isInteger(year) || year < 2000 || year > 2026 || seen.has(key)) continue;
        seen.add(key);
        rows.push({ title, year, aliases: Array.isArray(row.aliases) ? row.aliases : [] });
      } catch {
        // Collection must never manufacture a row from malformed input.
      }
    }
  }
  return rows.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "ko"));
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/");
}

function instagramUrlsFromSearchHtml(html) {
  const urls = [];
  const seen = new Set();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    try {
      const link = new URL(decodeHtml(match[1]), "https://html.duckduckgo.com");
      const rawUrl = link.hostname.endsWith("duckduckgo.com")
        ? link.searchParams.get("uddg")
        : link.toString();
      const parsed = parseNativeSocialContent(rawUrl ?? "");
      if (!parsed || parsed.platform !== "Instagram" || seen.has(parsed.url)) continue;
      seen.add(parsed.url);
      urls.push(parsed);
    } catch {
      // Ignore malformed advertising and navigation links.
    }
  }
  return urls;
}

function searchUrl(query) {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

async function sleep(milliseconds) {
  await new Promise((done) => setTimeout(done, milliseconds));
}

async function findPublicInstagramUrls(query) {
  const response = await fetch(searchUrl(query), {
    headers: {
      "accept-language": "ko-KR,ko;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
    },
  });
  if (!response.ok) throw new Error(`public search HTTP ${response.status}`);
  const html = await response.text();
  if (/\b(?:anomaly|challenge|captcha|unusual traffic)\b/i.test(html)) {
    throw new Error("public search requested a challenge; stopping without retrying");
  }
  return instagramUrlsFromSearchHtml(html);
}

async function verifyPublicOEmbed(sourceUrl) {
  const endpoint = new URL("https://graph.facebook.com/v25.0/instagram_oembed");
  endpoint.searchParams.set("url", sourceUrl);
  endpoint.searchParams.set("omitscript", "true");
  const response = await fetch(endpoint, {
    headers: { "user-agent": "CatchMemeSourceCollector/1.0 (+https://catchmeme.com)" },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || data.type !== "rich") {
    throw new Error(`Instagram oEmbed HTTP ${response.status}`);
  }
}

async function collectMeme(meme) {
  // Search both Reels and classic posts — many Korean meme accounts publish
  // stills under /p/ while dance/skits land on /reel/.
  const queries = [
    `site:instagram.com/reel ${meme.title} 밈`,
    `site:instagram.com/p ${meme.title} 밈`,
  ];
  const found = [];
  const seen = new Set();
  const searchQueries = [];
  for (const query of queries) {
    const batch = await findPublicInstagramUrls(query);
    searchQueries.push(query);
    for (const source of batch) {
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      found.push({ ...source, search_query: query });
    }
  }
  const rows = [];
  for (const source of found.slice(0, perQuery)) {
    try {
      await verifyPublicOEmbed(source.url);
      rows.push({
        meme_title: meme.title,
        origin_year: meme.year,
        aliases: meme.aliases,
        source_platform: "Instagram",
        source_url: source.url,
        content_id: source.contentId,
        search_query: source.search_query,
        search_queries: searchQueries,
        oembed_verified_at: new Date().toISOString(),
        review_status: "needs_human_source_match",
        collection_note: "Public search candidate only. oEmbed confirmed a publicly embeddable post; verify the actual meme source and rights before publishing.",
      });
    } catch {
      // A result can disappear or become private between search and oEmbed.
    }
  }
  return rows;
}

const sourceMemes = readMemes(inputPath).filter((meme) => requestedYears.size === 0 || requestedYears.has(meme.year));
const memes = maxPerYear
  ? [...new Set(sourceMemes.map((meme) => meme.year))]
      .sort((a, b) => a - b)
      .flatMap((year) => sourceMemes.filter((meme) => meme.year === year).slice(0, maxPerYear))
      .slice(offset, offset + max)
  : sourceMemes.slice(offset, offset + max);
const results = [];
const errors = [];
for (const [index, meme] of memes.entries()) {
  try {
    results.push(...(await collectMeme(meme)));
    process.stderr.write(`collected ${index + 1}/${memes.length}: ${meme.title}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ title: meme.title, message });
    process.stderr.write(`failed ${index + 1}/${memes.length}: ${meme.title}\n`);
    if (message.includes("requested a challenge")) break;
  }
  if (index < memes.length - 1) await sleep(1_000);
}

const unique = [];
const seen = new Set();
for (const row of results) {
  const key = `${row.meme_title}\u0000${row.source_url}`;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(row);
  }
}
mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${unique.map((row) => JSON.stringify(row)).join("\n")}\n`);
process.stderr.write(`${JSON.stringify({ offset, queried: memes.length, candidates: unique.length, errors: errors.length })}\n`);
if (errors.length) writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
