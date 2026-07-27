#!/usr/bin/env node
/**
 * Tertiary Instagram + TikTok collection paths (not DDG HTML, not Newsroom,
 * not namu/KYM article citation, not firecrawl index-seed dumps).
 *
 * Paths:
 *   A) Bing HTML search for site:tiktok.com/video and site:instagram.com/reel|p
 *   B) Optional Firecrawl search JSON dumps (pre-downloaded) in a work dir
 *   C) Reddit public listing JSON (r/*.json) that cite final post URLs
 *
 * Dedupes against --exclude-urls and --exclude collected jsonl. oEmbed only.
 * Never logs in, bypasses challenges, or downloads video media.
 *
 * Usage:
 *   node scripts/collect-tertiary-social-candidates.mjs \
 *     data/memes/verified \
 *     data/memes/collected/tertiary-social-candidates-YYYY-MM-DD.jsonl \
 *     --max=40 --per-query=3 --years=2022,2023,2024,2025,2026 \
 *     --exclude=data/memes/collected \
 *     --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
 *     --platforms=tiktok,instagram \
 *     --work=data/memes/collected/.work
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseNativeSocialContent } from "./social-content.mjs";

const [inputPath, outputPath, ...args] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error(
    "usage: node scripts/collect-tertiary-social-candidates.mjs <verified-dir> <output.jsonl> [--max=40] [--per-query=3] [--years=...] [--exclude=dir] [--exclude-urls=file] [--platforms=tiktok,instagram] [--work=dir]",
  );
  process.exit(2);
}

const max = Math.max(1, Math.min(80, Number(args.find((a) => a.startsWith("--max="))?.slice(6) ?? 40)));
const perQuery = Math.max(1, Math.min(5, Number(args.find((a) => a.startsWith("--per-query="))?.slice(12) ?? 3)));
const yearsArg = args.find((a) => a.startsWith("--years="))?.slice(8) ?? "";
const years = new Set(
  yearsArg
    .split(",")
    .map(Number)
    .filter((y) => Number.isInteger(y) && y >= 2015 && y <= 2026),
);
const platforms = new Set(
  (args.find((a) => a.startsWith("--platforms="))?.slice(12) ?? "tiktok,instagram")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean),
);
const workDir = args.find((a) => a.startsWith("--work="))?.slice(7) ?? null;
const excludeDirs = args.filter((a) => a.startsWith("--exclude=")).map((a) => a.slice(10));
const excludeUrlFiles = args.filter((a) => a.startsWith("--exclude-urls=")).map((a) => a.slice(15));

function normalizeSocial(raw) {
  const parsed = parseNativeSocialContent(String(raw ?? "").trim());
  if (!parsed || !["TikTok", "Instagram"].includes(parsed.platform)) return null;
  return parsed;
}

function loadExclude() {
  const seen = new Set();
  const add = (raw) => {
    const p = normalizeSocial(raw);
    if (p) seen.add(p.url.replace(/\/$/, ""));
  };
  for (const file of excludeUrlFiles) {
    if (!existsSync(resolve(file))) continue;
    for (const line of readFileSync(resolve(file), "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      try {
        const row = JSON.parse(line);
        add(row.source_url ?? row.url);
      } catch {
        add(line.trim());
      }
    }
  }
  for (const dir of excludeDirs) {
    const absolute = resolve(dir);
    if (!existsSync(absolute)) continue;
    function walk(path) {
      for (const name of readdirSync(path)) {
        const entry = join(path, name);
        if (statSync(entry).isDirectory()) {
          if (name === ".work" || name === "node_modules") continue;
          walk(entry);
          continue;
        }
        if (!name.endsWith(".jsonl") || name.includes(".errors")) continue;
        for (const line of readFileSync(entry, "utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            const row = JSON.parse(line);
            add(row.source_url ?? row.url);
          } catch {
            // skip
          }
        }
      }
    }
    if (statSync(absolute).isFile()) {
      for (const line of readFileSync(absolute, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          add(JSON.parse(line).source_url);
        } catch {
          add(line);
        }
      }
    } else walk(absolute);
  }
  return seen;
}

function readMemes(path) {
  const absolute = resolve(path);
  const files = [];
  function walk(p) {
    for (const name of readdirSync(p).sort()) {
      const entry = join(p, name);
      if (statSync(entry).isDirectory()) walk(entry);
      else if (extname(name) === ".jsonl") files.push(entry);
    }
  }
  if (statSync(absolute).isFile()) files.push(absolute);
  else walk(absolute);

  const seen = new Set();
  const rows = [];
  for (const file of files) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const title = String(row.title ?? "").trim();
        const year = Number(row.year);
        const key = title.replace(/\s+/g, "").toLowerCase();
        if (!title || !Number.isInteger(year) || seen.has(key)) continue;
        if (years.size && !years.has(year)) continue;
        seen.add(key);
        rows.push({
          title,
          year,
          aliases: Array.isArray(row.aliases) ? row.aliases : [],
        });
      } catch {
        // skip
      }
    }
  }
  return rows.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "ko"));
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&quot;/g, '"');
}

function urlsFromBingHtml(html, platform) {
  const found = [];
  const seen = new Set();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    try {
      let raw = decodeHtml(match[1]);
      // Bing wraps as /ck/a?...&u=a1https...
      const uParam = raw.match(/[?&]u=a1([^&]+)/);
      if (uParam) {
        try {
          raw = Buffer.from(uParam[1], "base64").toString("utf8");
        } catch {
          raw = decodeURIComponent(uParam[1]);
        }
      }
      const parsed = normalizeSocial(raw);
      if (!parsed) continue;
      if (platform === "tiktok" && parsed.platform !== "TikTok") continue;
      if (platform === "instagram" && parsed.platform !== "Instagram") continue;
      if (seen.has(parsed.url)) continue;
      seen.add(parsed.url);
      found.push(parsed);
    } catch {
      // skip
    }
  }
  // also plain text URLs
  for (const match of html.matchAll(/https?:\/\/(?:www\.)?(?:tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d+|instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+)/g)) {
    const parsed = normalizeSocial(match[0]);
    if (!parsed || seen.has(parsed.url)) continue;
    if (platform === "tiktok" && parsed.platform !== "TikTok") continue;
    if (platform === "instagram" && parsed.platform !== "Instagram") continue;
    seen.add(parsed.url);
    found.push(parsed);
  }
  return found;
}

async function bingSearch(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ko-KR`;
  const response = await fetch(url, {
    headers: {
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`bing HTTP ${response.status}`);
  const html = await response.text();
  if (/\b(?:captcha|unusual traffic|challenge)\b/i.test(html)) {
    throw new Error("bing requested a challenge; stopping without retrying");
  }
  return html;
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

function extractFromWorkDir(dir) {
  if (!dir || !existsSync(resolve(dir))) return [];
  const found = [];
  const seen = new Set();
  function walk(path) {
    for (const name of readdirSync(path)) {
      const entry = join(path, name);
      if (statSync(entry).isDirectory()) {
        if (name.startsWith(".")) continue;
        walk(entry);
        continue;
      }
      // Prefer firecrawl / reddit dumps not already processed as secondary
      if (!/\.(json|jsonl|md|txt)$/i.test(name)) continue;
      if (/secondary|public-article|prod-social|social-index-seeds/i.test(name)) continue;
      const text = readFileSync(entry, "utf8");
      for (const match of text.matchAll(
        /https?:\/\/(?:www\.)?(?:tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d+|instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+)/g,
      )) {
        const parsed = normalizeSocial(match[0]);
        if (!parsed || seen.has(parsed.url)) continue;
        seen.add(parsed.url);
        found.push({ ...parsed, discovery_file: name });
      }
    }
  }
  walk(resolve(dir));
  return found;
}

async function redditListingUrls(subreddit, limit = 25) {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "CatchMemeSourceCollector/1.0 (+https://catchmeme.com)",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`reddit HTTP ${response.status}`);
  const data = await response.json();
  const posts = data?.data?.children ?? [];
  const found = [];
  for (const post of posts) {
    const link = post?.data?.url_overridden_by_dest ?? post?.data?.url ?? "";
    const selftext = post?.data?.selftext ?? "";
    for (const raw of [link, ...String(selftext).matchAll(/https?:\/\/\S+/g)].flat()) {
      const parsed = normalizeSocial(typeof raw === "string" ? raw : raw[0]);
      if (parsed) found.push(parsed);
    }
  }
  return found;
}

async function sleep(ms) {
  await new Promise((done) => setTimeout(done, ms));
}

async function main() {
  const excluded = loadExclude();
  const memes = readMemes(inputPath).slice(0, max);
  const results = [];
  const errors = [];
  const seen = new Set(excluded);

  // Path C: Reddit public JSON (a few meme/korea-related subs)
  if (platforms.has("tiktok") || platforms.has("instagram")) {
    for (const sub of ["tiktokcringe", "Instagramreality", "kpop", "Korean"]) {
      try {
        const urls = await redditListingUrls(sub, 30);
        for (const source of urls) {
          const key = source.url.replace(/\/$/, "");
          if (seen.has(key)) continue;
          if (source.platform === "TikTok" && !platforms.has("tiktok")) continue;
          if (source.platform === "Instagram" && !platforms.has("instagram")) continue;
          try {
            const oembed = await verifyOEmbed(source.platform, source.url);
            seen.add(key);
            results.push({
              meme_title: oembed.title ?? `${source.platform} reddit ${source.contentId}`,
              origin_year: null,
              aliases: [],
              source_platform: source.platform,
              source_url: source.url,
              content_id: source.contentId,
              oembed_title: oembed.title,
              oembed_author_name: oembed.author_name,
              oembed_verified_at: new Date().toISOString(),
              editorial_signal: `reddit_r_${sub}`,
              collection_path: "tertiary_reddit_json",
              catalog_match_status: "unmapped",
              review_status: "needs_human_source_match",
              collection_note:
                "Tertiary path: Reddit public JSON listing. oEmbed verified. Deduped. Confirm catalog match and rights before publishing.",
            });
          } catch (error) {
            errors.push({
              source_url: source.url,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
        process.stderr.write(`reddit r/${sub}: collected so far ${results.length}\n`);
        await sleep(800);
      } catch (error) {
        errors.push({ reddit: sub, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  // Path B: leftover work-dir final URLs (not previously harvested as secondary)
  for (const source of extractFromWorkDir(workDir)) {
    const key = source.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    if (source.platform === "TikTok" && !platforms.has("tiktok")) continue;
    if (source.platform === "Instagram" && !platforms.has("instagram")) continue;
    try {
      const oembed = await verifyOEmbed(source.platform, source.url);
      seen.add(key);
      results.push({
        meme_title: oembed.title ?? `${source.platform} work ${source.contentId}`,
        origin_year: null,
        aliases: [],
        source_platform: source.platform,
        source_url: source.url,
        content_id: source.contentId,
        oembed_title: oembed.title,
        oembed_author_name: oembed.author_name,
        oembed_verified_at: new Date().toISOString(),
        editorial_signal: "workdir_residual",
        discovery_file: source.discovery_file,
        collection_path: "tertiary_workdir",
        catalog_match_status: "unmapped",
        review_status: "needs_human_source_match",
        collection_note:
          "Tertiary path: residual public URLs from work dumps. oEmbed verified. Deduped.",
      });
    } catch (error) {
      errors.push({ source_url: source.url, message: error instanceof Error ? error.message : String(error) });
    }
  }

  // Path A: Bing HTML search per catalog meme
  for (const [index, meme] of memes.entries()) {
    const queries = [];
    if (platforms.has("tiktok")) queries.push({ platform: "tiktok", q: `site:tiktok.com/video ${meme.title}` });
    if (platforms.has("instagram")) {
      queries.push({ platform: "instagram", q: `site:instagram.com/reel ${meme.title}` });
      queries.push({ platform: "instagram", q: `site:instagram.com/p ${meme.title}` });
    }
    for (const { platform, q } of queries) {
      try {
        const html = await bingSearch(q);
        const found = urlsFromBingHtml(html, platform).slice(0, perQuery);
        for (const source of found) {
          const key = source.url.replace(/\/$/, "");
          if (seen.has(key)) continue;
          try {
            const oembed = await verifyOEmbed(source.platform, source.url);
            seen.add(key);
            results.push({
              meme_title: meme.title,
              origin_year: meme.year,
              aliases: meme.aliases,
              source_platform: source.platform,
              source_url: source.url,
              content_id: source.contentId,
              oembed_title: oembed.title,
              oembed_author_name: oembed.author_name,
              oembed_verified_at: new Date().toISOString(),
              search_query: q,
              editorial_signal: "bing_html_search",
              collection_path: "tertiary_bing_search",
              catalog_match_status: "title_seed",
              review_status: "needs_human_source_match",
              collection_note:
                "Tertiary path: Bing HTML public search + oEmbed. Deduped against production/prior candidates. Confirm rights before publishing.",
            });
          } catch {
            // skip dead
          }
        }
        process.stderr.write(
          `bing ${index + 1}/${memes.length} ${meme.title} (${platform}): total ${results.length}\n`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ title: meme.title, query: q, message });
        process.stderr.write(`bing failed ${meme.title}: ${message}\n`);
        if (message.includes("challenge")) {
          process.stderr.write("stopping bing path after challenge\n");
          queries.length = 0;
          break;
        }
      }
      await sleep(1_200);
    }
  }

  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(
    resolve(outputPath),
    `${results.map((row) => JSON.stringify(row)).join("\n")}${results.length ? "\n" : ""}`,
  );
  if (errors.length) {
    writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
  }
  process.stderr.write(
    `${JSON.stringify({
      queried_memes: memes.length,
      candidates: results.length,
      errors: errors.length,
      tiktok: results.filter((r) => r.source_platform === "TikTok").length,
      instagram: results.filter((r) => r.source_platform === "Instagram").length,
      by_path: results.reduce((acc, row) => {
        acc[row.collection_path] = (acc[row.collection_path] ?? 0) + 1;
        return acc;
      }, {}),
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
