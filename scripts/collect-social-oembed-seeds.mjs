#!/usr/bin/env node
/**
 * Verify manually discovered final Instagram and TikTok post URLs as
 * review-only candidates via public oEmbed. Accepts both platforms in one
 * seed file (TikTok-only seeds still work with collect-tiktok-oembed-candidates).
 *
 * Does not log in, scrape platform pages, download media, or publish to Supabase.
 *
 * Seed JSONL fields:
 *   source_url (required) — final tiktok.com/@.../video/... or instagram.com/(reel|p|tv)/...
 *   meme_title, origin_year, aliases, discovery_url, discovery_note (optional)
 *
 * Usage:
 *   node scripts/collect-social-oembed-seeds.mjs <seed.jsonl> <output.jsonl>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseNativeSocialContent } from "./social-content.mjs";
import { verifySocialSeedOEmbed } from "./public-article-social.mjs";

const [seedPath, outputPath] = process.argv.slice(2);
if (!seedPath || !outputPath) {
  console.error("usage: node scripts/collect-social-oembed-seeds.mjs <seed.jsonl> <output.jsonl>");
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
      const memeTitle = String(seed.meme_title ?? seed.title ?? "").trim();
      const originYear = Number(seed.origin_year ?? seed.year);
      const key = `${memeTitle}\u0000${source?.url ?? ""}`;
      if (
        !source ||
        !["TikTok", "Instagram"].includes(source.platform) ||
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
        source_platform: source.platform,
        content_id: source.contentId,
        discovery_url: typeof seed.discovery_url === "string" ? seed.discovery_url : null,
        discovery_note:
          typeof seed.discovery_note === "string" ? seed.discovery_note.slice(0, 500) : null,
      });
    } catch {
      // Bad seed rows never become candidates.
    }
  }
  return rows;
}

async function main() {
  const results = [];
  const errors = [];
  const seeds = seedsFromJsonl(seedPath);

  for (const [index, seed] of seeds.entries()) {
    try {
      const verified = await verifySocialSeedOEmbed(seed.source_url);
      results.push({
        ...seed,
        source_platform: verified.platform,
        content_id: verified.contentId,
        oembed_title: verified.oembed.title,
        oembed_author_name: verified.oembed.author_name,
        oembed_verified_at: new Date().toISOString(),
        review_status: "needs_human_source_match",
        collection_note:
          "Public index/seed candidate only. oEmbed confirmed a publicly embeddable post; verify relevance and rights before publishing.",
      });
      process.stderr.write(
        `verified ${index + 1}/${seeds.length}: ${seed.source_platform} ${seed.content_id}\n`,
      );
    } catch (error) {
      errors.push({
        source_url: seed.source_url,
        platform: seed.source_platform,
        message: error instanceof Error ? error.message : String(error),
      });
      process.stderr.write(`failed ${index + 1}/${seeds.length}: ${seed.source_url}\n`);
    }
  }

  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(
    absoluteOutput,
    `${results.map((row) => JSON.stringify(row)).join("\n")}${results.length ? "\n" : ""}`,
  );
  if (errors.length) {
    writeFileSync(`${absoluteOutput}.errors.json`, `${JSON.stringify(errors, null, 2)}\n`);
  }
  process.stderr.write(
    `${JSON.stringify({
      seeds: seeds.length,
      candidates: results.length,
      errors: errors.length,
      tiktok: results.filter((row) => row.source_platform === "TikTok").length,
      instagram: results.filter((row) => row.source_platform === "Instagram").length,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
