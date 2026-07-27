#!/usr/bin/env node
/**
 * Secondary Instagram + TikTok collection paths that do not repeat DDG HTML
 * search, TikTok Newsroom, or the earlier firecrawl index-seed pass.
 *
 * Paths:
 *   A) namu.wiki individual challenge/meme pages (not just the period hub)
 *   B) knowyourmeme.com public article pages
 *   C) curated HTTPS editorial/media URL list
 *
 * Each page is fetched once; final /video/ and /reel|p|tv/ URLs are extracted
 * and verified with public oEmbed. Login, challenge bypass, and media download
 * are never used. Output is review-only.
 *
 * Dedup: skips URLs already present in --exclude files (production dump or prior
 * candidate jsonl) and within the current run.
 *
 * Usage:
 *   node scripts/collect-secondary-social-candidates.mjs \
 *     data/memes/collected/.work/secondary-article-urls.txt \
 *     data/memes/collected/secondary-social-candidates-YYYY-MM-DD.jsonl \
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

const [inputPath, outputPath, ...args] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error(
    "usage: node scripts/collect-secondary-social-candidates.mjs <urls.txt|urls.jsonl|dir> <output.jsonl> [--exclude=dir] [--exclude-urls=file] [--verified=dir] [--max-pages=40] [--max-per-page=20]",
  );
  process.exit(2);
}

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
    // Prefer secondary path hosts; still allow any public article.
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

function secondaryPathLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "namu.wiki") return "namu_individual_page";
    if (host === "knowyourmeme.com") return "know_your_meme";
    if (host.endsWith("wikipedia.org")) return "wikipedia_citation";
    if (host === "newsroom.tiktok.com") return "tiktok_newsroom_secondary";
    return "editorial_media";
  } catch {
    return "editorial_media";
  }
}

async function main() {
  const excluded = loadExcludeUrls();
  const memes = loadCatalogMemes(verifiedDir);
  const articles = articleUrlsFromInput(inputPath).slice(0, maxPages);
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
      const pathLabel = secondaryPathLabel(articleUrl);
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
          collection_path: "secondary_public_article",
          collection_note:
            "Secondary path (namu individual / KYM / editorial). oEmbed verified; catalog match uses oEmbed metadata only. Deduped against prior candidates/production. Confirm rights before publishing.",
        });
      }
      for (const err of result.errors) {
        errors.push({ ...err, article_url: articleUrl });
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

  process.stderr.write(
    `${JSON.stringify({
      pages: articles.length,
      discovered,
      candidates: candidates.length,
      skipped_duplicates: skippedDup,
      errors: errors.length,
      tiktok: candidates.filter((r) => r.source_platform === "TikTok").length,
      instagram: candidates.filter((r) => r.source_platform === "Instagram").length,
      mapped: candidates.filter((r) => r.catalog_match_status === "title_overlap").length,
      by_path: candidates.reduce((acc, row) => {
        acc[row.editorial_signal] = (acc[row.editorial_signal] ?? 0) + 1;
        return acc;
      }, {}),
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
