#!/usr/bin/env node
/**
 * Verify manually discovered, publicly indexed TikTok video URLs as review-only
 * candidates. It does not use the TikTok Display API, sign in, scrape TikTok
 * pages, download video media, or publish rows to Supabase.
 *
 * The input must contain final tiktok.com/@username/video/{id} URLs gathered
 * from public webpages. oEmbed only verifies public embeddability; a reviewer
 * must still confirm relevance and rights before publication.
 *
 * Usage:
 *   node scripts/collect-tiktok-oembed-candidates.mjs <seed.jsonl> <output.jsonl>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseNativeSocialContent } from "./social-content.mjs";

const [seedPath, outputPath] = process.argv.slice(2);
if (!seedPath || !outputPath) {
  console.error("usage: node scripts/collect-tiktok-oembed-candidates.mjs <seed.jsonl> <output.jsonl>");
  process.exit(2);
}
if (!existsSync(resolve(seedPath))) {
  console.error(`seed was not found: ${seedPath}`);
  process.exit(2);
}

function seedsFromJsonl(path) {
  const rows = [];
  const seen = new Set();
  for (const line of readFileSync(resolve(path), "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const seed = JSON.parse(line);
      const source = parseNativeSocialContent(seed.source_url);
      const memeTitle = String(seed.meme_title ?? "").trim();
      const originYear = Number(seed.origin_year);
      const key = `${memeTitle}\u0000${source?.url ?? ""}`;
      if (
        !source ||
        source.platform !== "TikTok" ||
        !memeTitle ||
        !Number.isInteger(originYear) ||
        originYear < 2000 ||
        originYear > 2026 ||
        seen.has(key)
      ) {
        continue;
      }
      seen.add(key);
      rows.push({
        meme_title: memeTitle,
        origin_year: originYear,
        aliases: Array.isArray(seed.aliases) ? seed.aliases : [],
        source_url: source.url,
        discovery_url: typeof seed.discovery_url === "string" ? seed.discovery_url : null,
        discovery_note: typeof seed.discovery_note === "string" ? seed.discovery_note.slice(0, 500) : null,
      });
    } catch {
      // Bad seed rows never become candidates.
    }
  }
  return rows;
}

async function verifyOEmbed(sourceUrl) {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", sourceUrl);
  const response = await fetch(endpoint, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)" },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || data.provider_name !== "TikTok" || typeof data.html !== "string") {
    throw new Error(`TikTok oEmbed HTTP ${response.status}`);
  }
  return {
    title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
    author_name: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
  };
}

const results = [];
const errors = [];
for (const seed of seedsFromJsonl(seedPath)) {
  try {
    const oembed = await verifyOEmbed(seed.source_url);
    results.push({
      ...seed,
      source_platform: "TikTok",
      content_id: parseNativeSocialContent(seed.source_url)?.contentId ?? null,
      oembed_title: oembed.title,
      oembed_author_name: oembed.author_name,
      oembed_verified_at: new Date().toISOString(),
      review_status: "needs_human_source_match",
      collection_note: "Public web-index candidate only. TikTok oEmbed confirmed a publicly embeddable post; verify relevance and rights before publishing.",
    });
  } catch (error) {
    errors.push({ source_url: seed.source_url, message: error instanceof Error ? error.message : String(error) });
  }
}

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${results.map((row) => JSON.stringify(row)).join("\n")}\n`);
if (errors.length) writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
process.stderr.write(`${JSON.stringify({ seeds: seedsFromJsonl(seedPath).length, candidates: results.length, errors: errors.length })}\n`);
