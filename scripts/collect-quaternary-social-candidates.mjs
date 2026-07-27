#!/usr/bin/env node
/**
 * Quaternary Instagram + TikTok collection path.
 *
 * Differs from DDG / Newsroom / namu-KYM article / Bing tertiary:
 *   - Firecrawl scrape of Know Your Meme challenge pages + target namu pages
 *   - Firecrawl search JSON dumps (when available)
 *   - Rule-based hashtag → catalog title mapping after oEmbed
 *
 * Dedupes against --exclude-urls (production). Never logins or bypasses challenges.
 *
 * Usage:
 *   node scripts/collect-quaternary-social-candidates.mjs \
 *     data/memes/collected/.work/quaternary-fc \
 *     data/memes/collected/quaternary-oembed-YYYY-MM-DD.jsonl \
 *     --exclude-urls=data/memes/collected/.work/prod-social-urls.txt
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseNativeSocialContent } from "./social-content.mjs";

const [workDir, outputPath, ...args] = process.argv.slice(2);
if (!workDir || !outputPath) {
  console.error(
    "usage: node scripts/collect-quaternary-social-candidates.mjs <work-dir> <output.jsonl> [--exclude-urls=file]",
  );
  process.exit(2);
}

const excludeFile = args.find((a) => a.startsWith("--exclude-urls="))?.slice(15);
const excluded = new Set();
if (excludeFile && existsSync(resolve(excludeFile))) {
  for (const line of readFileSync(resolve(excludeFile), "utf8").split("\n")) {
    const t = line.trim().replace(/\/$/, "");
    if (t) excluded.add(t);
  }
}

function normalize(raw) {
  let u = String(raw ?? "");
  if (u.includes("instagram.com") && !u.endsWith("/")) u += "/";
  return parseNativeSocialContent(u);
}

const found = new Map();
const root = resolve(workDir);
for (const name of readdirSync(root)) {
  if (!/\.(md|json|txt)$/i.test(name)) continue;
  const text = readFileSync(join(root, name), "utf8");
  for (const m of text.matchAll(
    /https:\/\/(?:www\.)?(?:tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d+|instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+)/g,
  )) {
    const p = normalize(m[0]);
    if (!p) continue;
    const key = p.url.replace(/\/$/, "");
    if (excluded.has(key) || found.has(key)) continue;
    found.set(key, { ...p, discovery_file: name });
  }
}

async function oembed(platform, url) {
  if (platform === "TikTok") {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", url);
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.provider_name !== "TikTok" || typeof data.html !== "string") {
      throw new Error(`TikTok oEmbed ${response.status}`);
    }
    return {
      title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
      author_name: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
    };
  }
  const endpoint = new URL("https://graph.facebook.com/v25.0/instagram_oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("omitscript", "true");
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.type !== "rich") throw new Error(`Instagram oEmbed ${response.status}`);
  return {
    title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
    author_name: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
  };
}

const results = [];
const errors = [];
let i = 0;
for (const item of found.values()) {
  i++;
  try {
    const oe = await oembed(item.platform, item.url);
    results.push({
      source_platform: item.platform,
      source_url: item.url,
      content_id: item.contentId,
      oembed_title: oe.title,
      oembed_author_name: oe.author_name,
      oembed_verified_at: new Date().toISOString(),
      discovery_file: item.discovery_file,
      collection_path: "quaternary_firecrawl_scrape",
      review_status: "needs_human_source_match",
      collection_note:
        "Quaternary path: Firecrawl scrape of KYM/namu/search dumps + public oEmbed. Deduped against production.",
    });
  } catch (error) {
    errors.push({ source_url: item.url, message: error instanceof Error ? error.message : String(error) });
  }
  if (i % 15 === 0) process.stderr.write(`oembed ${i}/${found.size}\n`);
}

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(
  resolve(outputPath),
  `${results.map((r) => JSON.stringify(r)).join("\n")}${results.length ? "\n" : ""}`,
);
if (errors.length) writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
process.stderr.write(
  `${JSON.stringify({
    discovered: found.size,
    candidates: results.length,
    errors: errors.length,
    tiktok: results.filter((r) => r.source_platform === "TikTok").length,
    instagram: results.filter((r) => r.source_platform === "Instagram").length,
  })}\n`,
);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // CLI already ran above
}
