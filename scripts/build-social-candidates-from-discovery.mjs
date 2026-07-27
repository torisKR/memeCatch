#!/usr/bin/env node
/**
 * Convert Firecrawl/public-index discovery snippets into review-only TikTok and
 * Instagram candidates. Only final tiktok.com/@.../video/... and
 * instagram.com/(reel|p|tv)/... URLs are kept; each is verified with public
 * oEmbed. No login, challenge bypass, or embed HTML storage.
 *
 * Usage:
 *   node scripts/build-social-candidates-from-discovery.mjs \
 *     data/memes/collected/.work \
 *     data/memes/verified \
 *     data/memes/collected/social-discovery-candidates-YYYY-MM-DD.jsonl
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { parseNativeSocialContent } from "./social-content.mjs";

const [discoveryDir, verifiedDir, outputPath] = process.argv.slice(2);
if (!discoveryDir || !verifiedDir || !outputPath) {
  console.error(
    "usage: node scripts/build-social-candidates-from-discovery.mjs <discovery-dir> <verified-dir> <output.jsonl>",
  );
  process.exit(2);
}

function readJsonlMemes(dir) {
  const rows = [];
  const seen = new Set();
  for (const name of readdirSync(resolve(dir)).sort()) {
    if (extname(name) !== ".jsonl") continue;
    for (const line of readFileSync(join(resolve(dir), name), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const title = String(row.title ?? "").trim();
        const year = Number(row.year);
        const key = title.replace(/\s+/g, "").toLowerCase();
        if (!title || !Number.isInteger(year) || year < 2010 || year > 2026 || seen.has(key)) continue;
        seen.add(key);
        rows.push({
          title,
          year,
          aliases: Array.isArray(row.aliases) ? row.aliases : [],
          needles: [title, ...(Array.isArray(row.aliases) ? row.aliases : [])]
            .map((value) => String(value).replace(/\s+/g, "").toLowerCase())
            .filter(Boolean),
        });
      } catch {
        // Ignore malformed verified rows.
      }
    }
  }
  return rows;
}

function urlsFromText(text) {
  const found = [];
  const seen = new Set();
  for (const match of String(text).matchAll(/https?:\/\/[^\s)"'<>]+/g)) {
    let raw = match[0].replace(/[.,;!?]+$/, "");
    try {
      const parsed = parseNativeSocialContent(raw);
      if (!parsed || !["TikTok", "Instagram"].includes(parsed.platform) || seen.has(parsed.url)) continue;
      seen.add(parsed.url);
      found.push({ ...parsed, snippet: text.slice(Math.max(0, match.index - 120), match.index + 180) });
    } catch {
      // Skip malformed URLs.
    }
  }
  return found;
}

function matchMeme(snippet, memes) {
  const hay = String(snippet).replace(/\s+/g, "").toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const meme of memes) {
    for (const needle of meme.needles) {
      if (needle.length < 2) continue;
      if (hay.includes(needle) && needle.length > bestLen) {
        best = meme;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

async function verifyOEmbed(platform, sourceUrl) {
  if (platform === "TikTok") {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", sourceUrl);
    const response = await fetch(endpoint, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)" },
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.provider_name !== "TikTok" || typeof data.html !== "string") {
      throw new Error(`TikTok oEmbed HTTP ${response.status}`);
    }
    return {
      title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
      author_name: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
    };
  }
  const endpoint = new URL("https://graph.facebook.com/v25.0/instagram_oembed");
  endpoint.searchParams.set("url", sourceUrl);
  endpoint.searchParams.set("omitscript", "true");
  const response = await fetch(endpoint, {
    headers: { "user-agent": "CatchMemeSourceCollector/1.0 (+https://catchmeme.com)" },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.type !== "rich") throw new Error(`Instagram oEmbed HTTP ${response.status}`);
  return {
    title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
    author_name: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
  };
}

const memes = readJsonlMemes(verifiedDir);
const discoveryRoot = resolve(discoveryDir);
const discoveryFiles = readdirSync(discoveryRoot).filter((name) => /\.(json|md|txt)$/i.test(name));
const discovered = [];
const seenUrl = new Set();
for (const name of discoveryFiles) {
  const text = readFileSync(join(discoveryRoot, name), "utf8");
  for (const item of urlsFromText(text)) {
    if (seenUrl.has(item.url)) continue;
    seenUrl.add(item.url);
    discovered.push({ ...item, discovery_file: name });
  }
}

const candidates = [];
const errors = [];
for (const [index, item] of discovered.entries()) {
  const meme = matchMeme(`${item.snippet}\n${item.url}`, memes);
  try {
    const oembed = await verifyOEmbed(item.platform, item.url);
    candidates.push({
      meme_title: meme?.title ?? oembed.title ?? `${item.platform} discovery ${item.contentId}`,
      origin_year: meme?.year ?? null,
      aliases: meme?.aliases ?? [],
      source_platform: item.platform,
      source_url: item.url,
      content_id: item.contentId,
      oembed_title: oembed.title,
      oembed_author_name: oembed.author_name,
      oembed_verified_at: new Date().toISOString(),
      catalog_match_status: meme ? "title_overlap" : "unmapped",
      discovery_file: item.discovery_file,
      review_status: "needs_human_source_match",
      collection_note:
        "Public discovery URL with oEmbed verification only. Confirm meme match, originality, and rights before publishing.",
    });
    process.stderr.write(`verified ${index + 1}/${discovered.length}: ${item.platform} ${item.contentId}\n`);
  } catch (error) {
    errors.push({
      source_url: item.url,
      platform: item.platform,
      message: error instanceof Error ? error.message : String(error),
    });
    process.stderr.write(`failed ${index + 1}/${discovered.length}: ${item.url}\n`);
  }
}

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(
  resolve(outputPath),
  `${candidates.map((row) => JSON.stringify(row)).join("\n")}${candidates.length ? "\n" : ""}`,
);
if (errors.length) writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
process.stderr.write(
  `${JSON.stringify({ discovered: discovered.length, candidates: candidates.length, errors: errors.length, mapped: candidates.filter((c) => c.catalog_match_status === "title_overlap").length })}\n`,
);
