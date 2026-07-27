#!/usr/bin/env node
/**
 * Korean article-embedded Instagram/TikTok meme collection path: Korean
 * editorial/wiki/community pages that embed a post as evidence of a meme,
 * rather than platform search or official channels.
 *
 * Each page is fetched once; final Instagram/TikTok post URLs are extracted
 * and verified with public oEmbed via collectPublicArticleSocialCandidates.
 * When an Instagram URL's oEmbed verification fails, we fall back to a single
 * fetch of that post's public embed page (og:image / caption only) so the
 * row is never silently dropped. Login, challenge bypass, official APIs, and
 * media download are never used. Output is review-only.
 *
 * Dedup: skips URLs already present in --exclude files (production dump or prior
 * candidate jsonl), --exclude-urls files, --verified catalog, and within the
 * current run.
 *
 * Usage:
 *   node scripts/collect-korean-article-social-candidates.mjs \
 *     data/memes/collected/.work/korean-article-urls.txt \
 *     data/memes/collected/korean-article-social-candidates-YYYY-MM-DD.jsonl \
 *     --exclude=data/memes/collected \
 *     --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
 *     --verified=data/memes/verified \
 *     --max-pages=40 --max-per-page=20
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectPublicArticleSocialCandidates,
  officialHttpsArticleUrl,
} from "./public-article-social.mjs";
import { parseNativeSocialContent } from "./social-content.mjs";
import { instagramEmbedMetadataFromHtml } from "./social-public-page-metadata.mjs";

const MAX_HTML_BYTES = 1_000_000;

const [inputPath, outputPath, ...args] = process.argv.slice(2);

const maxPages = Math.max(
  1,
  Math.min(80, Number(args.find((a) => a.startsWith("--max-pages="))?.slice(12) ?? 40)),
);
const maxPerPage = Math.max(
  1,
  Math.min(50, Number(args.find((a) => a.startsWith("--max-per-page="))?.slice(15) ?? 20)),
);
const verifiedDir = args.find((a) => a.startsWith("--verified="))?.slice(11) ?? null;
const excludeDirs = args.filter((a) => a.startsWith("--exclude=")).map((a) => a.slice(10));
const excludeUrlFiles = args.filter((a) => a.startsWith("--exclude-urls=")).map((a) => a.slice(15));

function normalizeUrl(raw) {
  const parsed = parseNativeSocialContent(String(raw ?? "").trim());
  if (!parsed || !["TikTok", "Instagram"].includes(parsed.platform)) return null;
  return parsed.url.replace(/\/$/, "");
}

function loadExcludeUrls() {
  const seen = new Set();
  function add(raw) {
    const url = normalizeUrl(raw);
    if (url) seen.add(url);
  }

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
    const files = [];
    function walk(path) {
      for (const name of readdirSync(path)) {
        const entry = join(path, name);
        if (statSync(entry).isDirectory()) {
          if (name === "node_modules" || name === ".work") continue;
          walk(entry);
          continue;
        }
        if (name.endsWith(".jsonl") && !name.includes(".errors")) files.push(entry);
      }
    }
    if (statSync(absolute).isFile()) files.push(absolute);
    else walk(absolute);
    for (const file of files) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
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
  return seen;
}

function loadCatalogMemes(dir) {
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
          const aliases = Array.isArray(row.aliases) ? row.aliases : [];
          rows.push({ title, year, aliases, needles: [title, ...aliases] });
        } catch {
          // skip
        }
      }
    }
  }
  walk(resolve(dir));
  return rows;
}

function articleUrlsFromInput(raw) {
  const absolute = resolve(raw);
  const urls = [];
  const seen = new Set();
  const push = (value) => {
    const url = officialHttpsArticleUrl(String(value ?? "").trim());
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  if (/^https:\/\//i.test(raw) && !existsSync(absolute)) {
    push(raw);
    return urls;
  }
  if (!existsSync(absolute)) throw new Error(`input was not found: ${raw}`);

  if (statSync(absolute).isDirectory()) {
    for (const name of readdirSync(absolute).sort()) {
      if (!/\.(txt|jsonl|md)$/i.test(name)) continue;
      for (const line of readFileSync(join(absolute, name), "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (extname(name) === ".jsonl") {
          try {
            const row = JSON.parse(trimmed);
            push(row.article_url ?? row.url ?? row.editorial_source_url);
          } catch {
            // skip
          }
        } else {
          const m = trimmed.match(/https:\/\/[^\s)"'<>]+/);
          if (m) push(m[0]);
          else push(trimmed);
        }
      }
    }
    return urls;
  }

  const text = readFileSync(absolute, "utf8");
  if (extname(absolute) === ".jsonl") {
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        push(row.article_url ?? row.url ?? row.editorial_source_url);
      } catch {
        // skip
      }
    }
    return urls;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/https:\/\/[^\s)"'<>]+/);
    push(m ? m[0] : trimmed);
  }
  return urls;
}

function koreanPathLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "namu.wiki") return "namu_individual_page";
    if (host === "ko.wikipedia.org") return "ko_wikipedia";
    if (host === "careet.net") return "careet_article";
    if (host === "wikitree.co.kr") return "wikitree_news";
    if (host === "insight.co.kr") return "insight_news";
    if (host === "dispatch.co.kr") return "dispatch_news";
    if (host === "tenasia.hankyung.com") return "tenasia_news";
    if (host === "newsen.com") return "newsen_news";
    if (host === "osen.mt.co.kr") return "osen_news";
    if (host === "xportsnews.com") return "xports_news";
    if (host === "theqoo.net") return "theqoo_community";
    if (host === "instiz.net") return "instiz_community";
    if (host === "blog.naver.com") return "naver_blog";
    return "korean_article";
  } catch {
    return "korean_article";
  }
}

/**
 * Instagram-only fallback for posts whose oEmbed verification failed. Fetches
 * the public post embed page exactly once, never the private API, and never
 * bypasses a login/challenge wall.
 */
export async function instagramPublicPageFallback(sourceUrl, { fetchImpl = fetch } = {}) {
  const embedUrl = `${sourceUrl.replace(/\/$/, "")}/embed/captioned/`;
  let response;
  try {
    response = await fetchImpl(embedUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
        "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) return null;
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) return null;
  // Extract first: a page that publicly serves og/caption metadata is not a
  // challenge wall even when the embed HTML also contains login-form markup
  // (looksLikeAccessChallenge false-positives on embed/captioned pages).
  const metadata = instagramEmbedMetadataFromHtml(html);
  if (metadata.title || metadata.thumbnail_url) return metadata;
  // No public metadata: challenge wall or empty embed — skip either way.
  return null;
}

async function main() {
  if (!inputPath || !outputPath) {
    console.error(
      "usage: node scripts/collect-korean-article-social-candidates.mjs <urls.txt|urls.jsonl|dir> <output.jsonl> [--exclude=dir] [--exclude-urls=file] [--verified=dir] [--max-pages=40] [--max-per-page=20]",
    );
    process.exitCode = 2;
    return;
  }
  const excluded = loadExcludeUrls();
  const memes = loadCatalogMemes(verifiedDir);
  const allArticles = articleUrlsFromInput(inputPath);
  const articles = allArticles.slice(0, maxPages);
  if (allArticles.length > articles.length) {
    process.stderr.write(
      `note: ${allArticles.length - articles.length} seed URLs skipped due to --max-pages=${maxPages} clamp\n`,
    );
  }
  if (!articles.length) {
    console.error("no article URLs found in input");
    process.exitCode = 2;
    return;
  }

  const candidates = [];
  const errors = [];
  let discovered = 0;
  let skippedDup = 0;

  for (const [index, articleUrl] of articles.entries()) {
    try {
      const result = await collectPublicArticleSocialCandidates(articleUrl, {
        max: maxPerPage,
        memes,
      });
      discovered += result.discovered;
      const pathLabel = koreanPathLabel(articleUrl);

      for (const row of result.candidates) {
        const key = row.source_url.replace(/\/$/, "");
        if (excluded.has(key)) {
          skippedDup++;
          continue;
        }
        excluded.add(key);
        candidates.push({
          ...row,
          editorial_signal: pathLabel,
          collection_path: "korean_article_embedded",
          collection_note:
            "Korean article-embedded post citation; oEmbed verified. Catalog match uses oEmbed metadata only, never article HTML. Deduped against prior candidates/production. Confirm rights before publishing.",
          needs_thumb_backfill: !row.thumbnail_url ? true : undefined,
          // Endpoint answered but returned no usable metadata (Meta oEmbed
          // often 200s with null title/author): tag so reviewers do not read
          // "oEmbed verified" as metadata-verified.
          oembed_metadata:
            !row.oembed_title && !row.oembed_author_name && !row.thumbnail_url
              ? "empty"
              : undefined,
        });
      }

      for (const err of result.errors) {
        if (err.platform !== "Instagram") {
          errors.push({ ...err, article_url: articleUrl });
          continue;
        }
        const key = err.source_url.replace(/\/$/, "");
        if (excluded.has(key)) {
          skippedDup++;
          continue;
        }
        // Be polite between per-post fallback fetches; article-page pacing does
        // not cover these instagram.com requests.
        await new Promise((done) => setTimeout(done, 300));
        const metadata = await instagramPublicPageFallback(err.source_url);
        if (!metadata) {
          errors.push({ ...err, article_url: articleUrl });
          continue;
        }
        excluded.add(key);
        candidates.push({
          source_url: err.source_url,
          source_platform: "Instagram",
          thumbnail_url: metadata.thumbnail_url ?? null,
          // Honest provenance: this row was NOT oEmbed-verified. Embed-page
          // metadata uses the public_page_* field contract (see
          // collect-public-social-page-metadata.mjs); oembed_* keys stay null.
          oembed_title: null,
          oembed_author_name: null,
          public_page_title: metadata.title ?? null,
          public_page_author_name: metadata.author_name ?? null,
          public_page_verified_at: new Date().toISOString(),
          catalog_match_status: "unmapped",
          review_status: "needs_human_source_match",
          editorial_source_url: articleUrl,
          editorial_signal: pathLabel,
          collection_path: "korean_article_embedded",
          collection_note:
            "Korean article-embedded Instagram post; oEmbed verification failed so public embed-page metadata (og:image/caption only) was used once. Confirm rights before publishing.",
          needs_thumb_backfill: !metadata.thumbnail_url ? true : undefined,
          metadata_source: "public_page_og",
        });
      }

      process.stderr.write(
        `page ${index + 1}/${articles.length}: +${result.candidates.length} raw, path=${pathLabel} — ${articleUrl}\n`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ article_url: articleUrl, message });
      process.stderr.write(`page ${index + 1}/${articles.length} failed: ${message}\n`);
      if (/login or challenge/i.test(message)) {
        process.stderr.write("stopping after challenge/login response\n");
        break;
      }
    }
    if (index < articles.length - 1) {
      await new Promise((done) => setTimeout(done, 700));
    }
  }

  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(
    absoluteOutput,
    `${candidates.map((row) => JSON.stringify(row)).join("\n")}${candidates.length ? "\n" : ""}`,
  );
  const errorPath = `${absoluteOutput}.errors.json`;
  if (errors.length) writeFileSync(errorPath, `${JSON.stringify(errors, null, 2)}\n`);
  else if (existsSync(errorPath)) unlinkSync(errorPath);

  const withThumb = candidates.filter((row) => row.thumbnail_url).length;
  process.stderr.write(
    `${JSON.stringify({
      pages: articles.length,
      discovered,
      kept: candidates.length,
      skippedDup,
      errors: errors.length,
      thumbnailCoverage: candidates.length ? withThumb / candidates.length : 0,
      platformCounts: candidates.reduce((acc, row) => {
        acc[row.source_platform] = (acc[row.source_platform] ?? 0) + 1;
        return acc;
      }, {}),
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
