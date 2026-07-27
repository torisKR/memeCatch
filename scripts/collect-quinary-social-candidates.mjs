#!/usr/bin/env node
/**
 * Quinary Instagram + TikTok collection path (path F).
 *
 * Distinct from prior paths:
 *   A DDG HTML search
 *   B TikTok Newsroom year pages
 *   C Firecrawl index-seed dumps
 *   D namu/KYM individual articles (secondary)
 *   E Bing / Reddit dumps / workdir residual (tertiary)
 *   E' Firecrawl KYM challenge scrapes + hashtag rules (quaternary)
 *
 * This path:
 *   1) Firecrawl *web search* over entertainment/music media domains
 *      (Billboard, Soompi, Allkpop, Koreaboo, Rolling Stone, NME, Paper, etc.)
 *   2) Direct HTTPS fetch of those article pages + any seed URLs
 *   3) Wikipedia MediaWiki API (en/ko) externallinks + wikitext for
 *      challenge-related pages that cite final post URLs
 *   4) Optional pre-downloaded work-dir scrapes (.md/.json/.txt)
 *
 * Dedupes against --exclude-urls (production) and --exclude collected jsonl.
 * Public oEmbed only. Never logins, cookies, or challenge bypass.
 *
 * Usage:
 *   node scripts/collect-quinary-social-candidates.mjs \
 *     data/memes/collected/.work/quinary-fc \
 *     data/memes/collected/quinary-oembed-YYYY-MM-DD.jsonl \
 *     --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
 *     --exclude=data/memes/collected \
 *     --verified=data/memes/verified \
 *     --max-articles=24 --max-searches=8 --wiki=1
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { socialPostUrlsFromHtml, matchCatalogMeme } from "./public-article-social.mjs";
import { parseNativeSocialContent } from "./social-content.mjs";

const [workDir, outputPath, ...args] = process.argv.slice(2);
if (!workDir || !outputPath) {
  console.error(
    "usage: node scripts/collect-quinary-social-candidates.mjs <work-dir> <output.jsonl> [--exclude-urls=file] [--exclude=dir] [--verified=dir] [--max-articles=24] [--max-searches=8] [--wiki=1] [--no-search]",
  );
  process.exit(2);
}

const maxArticles = Math.max(
  1,
  Math.min(40, Number(args.find((a) => a.startsWith("--max-articles="))?.slice(15) ?? 24)),
);
const maxSearches = Math.max(
  0,
  Math.min(12, Number(args.find((a) => a.startsWith("--max-searches="))?.slice(15) ?? 8)),
);
const useWiki = (args.find((a) => a.startsWith("--wiki="))?.slice(7) ?? "1") !== "0";
const noSearch = args.includes("--no-search");
const verifiedDir = args.find((a) => a.startsWith("--verified="))?.slice(11) ?? null;
const excludeDirs = args.filter((a) => a.startsWith("--exclude=")).map((a) => a.slice(10));
const excludeUrlFiles = args.filter((a) => a.startsWith("--exclude-urls=")).map((a) => a.slice(15));

const UA =
  "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)";

const MEDIA_QUERIES = [
  'site:billboard.com "tiktok.com/@" challenge OR dance',
  'site:soompi.com tiktok challenge video',
  'site:allkpop.com "tiktok.com" challenge',
  'site:koreaboo.com instagram reel challenge OR tiktok',
  'site:rollingstone.com tiktok challenge "tiktok.com"',
  'site:nme.com tiktok challenge video',
  'site:papermag.com tiktok challenge',
  'site:theguardian.com tiktok challenge "tiktok.com/@"',
  'site:bbc.com tiktok challenge viral',
  'site:variety.com tiktok challenge dance',
];

const WIKI_PAGES = [
  // en
  ["en.wikipedia.org", "List of Internet challenges"],
  ["en.wikipedia.org", "Internet challenge"],
  ["en.wikipedia.org", "Renegade (dance)"],
  ["en.wikipedia.org", "In My Feelings challenge"],
  ["en.wikipedia.org", "Ice Bucket Challenge"],
  ["en.wikipedia.org", "Mannequin Challenge"],
  ["en.wikipedia.org", "Bottle Cap Challenge"],
  ["en.wikipedia.org", "Wipe It Down challenge"],
  ["en.wikipedia.org", "Don't Rush Challenge"],
  ["en.wikipedia.org", "Corn Kid"],
  ["en.wikipedia.org", "It's Corn"],
  ["en.wikipedia.org", "Devious lick"],
  ["en.wikipedia.org", "TikTok"],
  // ko — pages that may cite social posts
  ["ko.wikipedia.org", "틱톡"],
  ["ko.wikipedia.org", "인터넷 밈"],
  ["ko.wikipedia.org", "아이스 버킷 챌린지"],
];

function normalizeKey(raw) {
  const p = parseNativeSocialContent(String(raw ?? "").trim());
  if (!p || !["TikTok", "Instagram"].includes(p.platform)) return null;
  return { ...p, key: p.url.replace(/\/$/, "") };
}

function loadExclude() {
  const seen = new Set();
  const add = (raw) => {
    const n = normalizeKey(raw);
    if (n) seen.add(n.key);
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

function loadCatalog(dir) {
  if (!dir || !existsSync(resolve(dir))) return [];
  const rows = [];
  const seen = new Set();
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const entry = join(path, name);
      if (statSync(entry).isDirectory()) {
        walk(entry);
        continue;
      }
      if (!name.endsWith(".jsonl")) continue;
      for (const line of readFileSync(entry, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          const title = String(row.title ?? "").trim();
          const year = Number(row.year);
          const key = title.replace(/\s+/g, "").toLowerCase();
          if (!title || !Number.isInteger(year) || seen.has(key)) continue;
          seen.add(key);
          rows.push({
            title,
            year,
            aliases: Array.isArray(row.aliases) ? row.aliases : [],
            needles: [title, ...(Array.isArray(row.aliases) ? row.aliases : [])],
          });
        } catch {
          // skip
        }
      }
    }
  }
  walk(resolve(dir));
  return rows;
}

function harvestText(text, sourceLabel, found) {
  for (const post of socialPostUrlsFromHtml(text)) {
    const key = post.url.replace(/\/$/, "");
    if (found.has(key)) continue;
    found.set(key, {
      ...post,
      discovery_source: sourceLabel,
    });
  }
}

function firecrawlSearch(query, outFile) {
  try {
    execFileSync(
      "firecrawl",
      ["search", query, "--limit", "6", "-o", outFile, "--json"],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 90_000 },
    );
    return true;
  } catch (error) {
    process.stderr.write(
      `firecrawl search failed: ${query.slice(0, 60)}… ${error instanceof Error ? error.message : error}\n`,
    );
    return false;
  }
}

function extractArticleUrlsFromSearch(file) {
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, "utf8");
  const urls = new Set();
  // JSON mode (firecrawl CLI: { success, data: { web: [{url,...}] } })
  try {
    const data = JSON.parse(raw);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.data?.web)
        ? data.data.web
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.web)
            ? data.web
            : Array.isArray(data?.results)
              ? data.results
              : [];
    for (const item of list) {
      const u = item?.url ?? item?.link ?? item?.metadata?.sourceURL;
      if (typeof u === "string" && /^https:\/\//i.test(u)) urls.add(u.split("#")[0]);
    }
  } catch {
    // human-readable firecrawl search dump
    for (const m of raw.matchAll(/URL:\s*(https:\/\/\S+)/g)) {
      urls.add(m[1].replace(/[.,;)]+$/, ""));
    }
    for (const m of raw.matchAll(/https:\/\/[^\s"'<>]+/g)) {
      const u = m[0].replace(/[.,;)]+$/, "");
      if (!/tiktok\.com|instagram\.com|facebook\.com|google\./i.test(u)) urls.add(u);
    }
  }
  // drop platform posts — those are handled separately
  return [...urls].filter((u) => {
    try {
      const host = new URL(u).hostname.replace(/^www\./, "");
      return !["tiktok.com", "instagram.com", "vm.tiktok.com"].includes(host);
    } catch {
      return false;
    }
  });
}

async function fetchArticleHtml(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9,ko;q=0.7",
      "user-agent": UA,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(14_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
    throw new Error(`article HTTP ${response.status}`);
  }
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > 5_000_000) {
    throw new Error("article too large");
  }
  if (/\b(?:captcha|unusual traffic|login to continue|sign in to continue|are you a robot)\b/i.test(html)) {
    throw new Error("article challenge/login wall");
  }
  return html;
}

async function wikiHarvest(found) {
  for (const [host, title] of WIKI_PAGES) {
    try {
      // externallinks
      const elUrl = new URL(`https://${host}/w/api.php`);
      elUrl.searchParams.set("action", "query");
      elUrl.searchParams.set("prop", "extlinks");
      elUrl.searchParams.set("ellimit", "max");
      elUrl.searchParams.set("titles", title);
      elUrl.searchParams.set("format", "json");
      const elRes = await fetch(elUrl, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      const elData = await elRes.json().catch(() => null);
      const pages = elData?.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        for (const link of page.extlinks ?? []) {
          const href = typeof link === "string" ? link : link["*"] ?? link.url ?? "";
          harvestText(href, `wiki_extlinks:${host}:${title}`, found);
        }
      }

      // wikitext (may embed bare URLs)
      const wtUrl = new URL(`https://${host}/w/api.php`);
      wtUrl.searchParams.set("action", "query");
      wtUrl.searchParams.set("prop", "revisions");
      wtUrl.searchParams.set("rvprop", "content");
      wtUrl.searchParams.set("rvslots", "main");
      wtUrl.searchParams.set("titles", title);
      wtUrl.searchParams.set("format", "json");
      const wtRes = await fetch(wtUrl, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      const wtData = await wtRes.json().catch(() => null);
      for (const page of Object.values(wtData?.query?.pages ?? {})) {
        const revs = page.revisions ?? [];
        const content =
          revs[0]?.slots?.main?.["*"] ?? revs[0]?.["*"] ?? revs[0]?.content ?? "";
        if (content) harvestText(content, `wiki_wikitext:${host}:${title}`, found);
      }

      // also search API for pages that literally mention final post paths
      const srUrl = new URL(`https://${host}/w/api.php`);
      srUrl.searchParams.set("action", "query");
      srUrl.searchParams.set("list", "search");
      srUrl.searchParams.set("srsearch", 'insource:"tiktok.com/@" OR insource:"instagram.com/reel"');
      srUrl.searchParams.set("srlimit", "8");
      srUrl.searchParams.set("format", "json");
      const srRes = await fetch(srUrl, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      const srData = await srRes.json().catch(() => null);
      for (const hit of srData?.query?.search ?? []) {
        const hitTitle = hit.title;
        if (!hitTitle || WIKI_PAGES.some(([, t]) => t === hitTitle)) continue;
        const pageUrl = new URL(`https://${host}/w/api.php`);
        pageUrl.searchParams.set("action", "query");
        pageUrl.searchParams.set("prop", "revisions");
        pageUrl.searchParams.set("rvprop", "content");
        pageUrl.searchParams.set("rvslots", "main");
        pageUrl.searchParams.set("titles", hitTitle);
        pageUrl.searchParams.set("format", "json");
        const pageRes = await fetch(pageUrl, {
          headers: { "user-agent": UA },
          signal: AbortSignal.timeout(12_000),
        });
        const pageData = await pageRes.json().catch(() => null);
        for (const page of Object.values(pageData?.query?.pages ?? {})) {
          const revs = page.revisions ?? [];
          const content = revs[0]?.slots?.main?.["*"] ?? revs[0]?.["*"] ?? "";
          if (content) harvestText(content, `wiki_search:${host}:${hitTitle}`, found);
        }
      }
      process.stderr.write(`wiki ok ${host} ${title}\n`);
    } catch (error) {
      process.stderr.write(
        `wiki fail ${host} ${title}: ${error instanceof Error ? error.message : error}\n`,
      );
    }
  }
}

async function oembed(platform, url) {
  if (platform === "TikTok") {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", url);
    const response = await fetch(endpoint, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
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
  const response = await fetch(endpoint, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.type !== "rich") throw new Error(`Instagram oEmbed ${response.status}`);
  return {
    title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
    author_name: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
  };
}

async function main() {
  const root = resolve(workDir);
  mkdirSync(root, { recursive: true });
  const excluded = loadExclude();
  const memes = loadCatalog(verifiedDir);
  const found = new Map();

  // 1) Residual work-dir dumps
  if (existsSync(root)) {
    for (const name of readdirSync(root)) {
      if (!/\.(md|json|txt|html)$/i.test(name)) continue;
      const text = readFileSync(join(root, name), "utf8");
      harvestText(text, `workdir:${name}`, found);
    }
  }

  // 2) Firecrawl media-domain searches → article list
  const articleUrls = new Set();
  // seed articles from workdir search dumps
  for (const name of existsSync(root) ? readdirSync(root) : []) {
    if (!/search/i.test(name)) continue;
    for (const u of extractArticleUrlsFromSearch(join(root, name))) {
      articleUrls.add(u);
    }
  }

  if (!noSearch && maxSearches > 0) {
    let i = 0;
    for (const q of MEDIA_QUERIES) {
      if (i >= maxSearches) break;
      const out = join(root, `search-${i}.json`);
      process.stderr.write(`search ${i + 1}/${maxSearches}: ${q.slice(0, 70)}\n`);
      if (firecrawlSearch(q, out)) {
        for (const u of extractArticleUrlsFromSearch(out)) articleUrls.add(u);
        // also harvest any final post URLs that appeared in the SERP text
        harvestText(readFileSync(out, "utf8"), `firecrawl_search:${i}`, found);
      }
      i++;
      // polite pause between searches
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // seed file if present
  const seedFile = join(root, "article-seeds.txt");
  if (existsSync(seedFile)) {
    for (const line of readFileSync(seedFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("https://")) articleUrls.add(t.split("#")[0]);
    }
  }

  // 3) Wikipedia MediaWiki
  if (useWiki) {
    process.stderr.write("wiki harvest…\n");
    await wikiHarvest(found);
  }

  // 4) Fetch articles (cap)
  const articles = [...articleUrls].slice(0, maxArticles);
  process.stderr.write(`fetching ${articles.length} media articles…\n`);
  let articleOk = 0;
  let articleFail = 0;
  for (const url of articles) {
    try {
      const html = await fetchArticleHtml(url);
      harvestText(html, `media_article:${url}`, found);
      articleOk++;
      // persist for reproducibility
      const safe = url.replace(/https?:\/\//, "").replace(/[^\w.-]+/g, "_").slice(0, 80);
      writeFileSync(join(root, `article-${safe}.html`), html.slice(0, 400_000));
    } catch (error) {
      articleFail++;
      process.stderr.write(
        `article fail ${url}: ${error instanceof Error ? error.message : error}\n`,
      );
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // Drop excluded
  for (const key of [...found.keys()]) {
    if (excluded.has(key)) found.delete(key);
  }

  process.stderr.write(
    `discovered unique posts after exclude: ${found.size} (articles ok ${articleOk} fail ${articleFail})\n`,
  );

  // 5) oEmbed
  const results = [];
  const errors = [];
  let i = 0;
  for (const item of found.values()) {
    i++;
    try {
      const oe = await oembed(item.platform, item.url);
      const snippet = `${oe.title ?? ""}\n${oe.author_name ?? ""}`;
      const meme = matchCatalogMeme(snippet, memes);
      results.push({
        meme_title: meme?.title ?? oe.title ?? `${item.platform} quinary ${item.contentId}`,
        origin_year: meme?.year ?? null,
        aliases: meme?.aliases ?? [],
        source_platform: item.platform,
        source_url: item.url,
        content_id: item.contentId,
        oembed_title: oe.title,
        oembed_author_name: oe.author_name,
        oembed_verified_at: new Date().toISOString(),
        discovery_source: item.discovery_source,
        collection_path: "quinary_media_wiki",
        catalog_match_status: meme ? "title_overlap" : "unmapped",
        review_status: "needs_human_source_match",
        collection_note:
          "Quinary path: entertainment-media Firecrawl search + direct article fetch + Wikipedia MediaWiki API. Public oEmbed only; catalog match uses oEmbed title/author.",
      });
    } catch (error) {
      errors.push({
        source_url: item.url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    if (i % 10 === 0) process.stderr.write(`oembed ${i}/${found.size}\n`);
  }

  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(
    resolve(outputPath),
    `${results.map((r) => JSON.stringify(r)).join("\n")}${results.length ? "\n" : ""}`,
  );
  if (errors.length) {
    writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
  }
  process.stderr.write(
    `${JSON.stringify({
      discovered: found.size,
      candidates: results.length,
      errors: errors.length,
      tiktok: results.filter((r) => r.source_platform === "TikTok").length,
      instagram: results.filter((r) => r.source_platform === "Instagram").length,
      catalog_matched: results.filter((r) => r.catalog_match_status === "title_overlap").length,
      articles_ok: articleOk,
      articles_fail: articleFail,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
