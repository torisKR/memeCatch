#!/usr/bin/env node
/**
 * Collect review-only Instagram + TikTok candidates from public HTTPS articles
 * that already cite final post URLs. Unlike TikTok Newsroom-only collection,
 * any public editorial/wiki/media page is allowed — but not TikTok/Instagram
 * post pages themselves (use seed oEmbed collectors for those).
 *
 * No app key, login, cookie, challenge bypass, or video download. Output is
 * never published to Supabase automatically.
 *
 * Usage:
 *   node scripts/collect-public-article-social-candidates.mjs \
 *     <article-url | urls.txt | urls.jsonl> <output.jsonl> \
 *     [--max-per-article=40] [--verified=data/memes/verified] [--year=2024]
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

const [inputPath, outputPath, ...args] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error(
    "usage: node scripts/collect-public-article-social-candidates.mjs <article-url|urls.txt|urls.jsonl> <output.jsonl> [--max-per-article=40] [--verified=dir] [--year=YYYY]",
  );
  process.exit(2);
}

const maxArg = args.find((arg) => arg.startsWith("--max-per-article="));
const verifiedArg = args.find((arg) => arg.startsWith("--verified="));
const yearArg = args.find((arg) => arg.startsWith("--year="));
const maxPerArticle = Math.max(1, Math.min(100, Number(maxArg?.slice(18) ?? 40)));
const verifiedDir = verifiedArg?.slice(11) ?? null;
const forcedYear = yearArg ? Number(yearArg.slice(7)) : null;

function articleUrlsFromInput(raw) {
  const absolute = resolve(raw);
  if (/^https:\/\//i.test(raw) && !existsSync(absolute)) {
    const url = officialHttpsArticleUrl(raw);
    return url ? [url] : [];
  }
  if (!existsSync(absolute)) throw new Error(`input was not found: ${raw}`);

  const text = readFileSync(absolute, "utf8");
  const urls = [];
  const seen = new Set();
  const push = (value) => {
    const url = officialHttpsArticleUrl(String(value ?? "").trim());
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  if (extname(absolute) === ".jsonl") {
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        push(row.article_url ?? row.url ?? row.editorial_source_url ?? row.source_url);
      } catch {
        // Ignore malformed seed rows.
      }
    }
    return urls;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    push(trimmed);
  }
  return urls;
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
          rows.push({
            title,
            year,
            aliases,
            needles: [title, ...aliases]
              .map((value) => String(value).replace(/\s+/g, "").toLowerCase())
              .filter(Boolean),
          });
        } catch {
          // Ignore malformed catalog rows.
        }
      }
    }
  }
  walk(resolve(dir));
  return rows;
}

async function main() {
  const articles = articleUrlsFromInput(inputPath);
  if (articles.length === 0) {
    console.error("no public article URLs found in input");
    process.exitCode = 2;
    return;
  }

  const memes = loadCatalogMemes(verifiedDir);
  const candidates = [];
  const errors = [];
  let discovered = 0;

  for (const [index, articleUrl] of articles.entries()) {
    try {
      const result = await collectPublicArticleSocialCandidates(articleUrl, {
        max: maxPerArticle,
        memes,
        originYear: Number.isInteger(forcedYear) ? forcedYear : null,
      });
      discovered += result.discovered;
      candidates.push(...result.candidates);
      errors.push(...result.errors.map((error) => ({ ...error, article_url: articleUrl })));
      process.stderr.write(
        `article ${index + 1}/${articles.length}: ${result.candidates.length}/${result.discovered} ok — ${articleUrl}\n`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ article_url: articleUrl, message });
      process.stderr.write(`article ${index + 1}/${articles.length} failed: ${message}\n`);
      if (/login or challenge/i.test(message)) {
        process.stderr.write("stopping remaining articles after challenge/login response\n");
        break;
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const row of candidates) {
    const key = `${row.source_platform}\u0000${row.source_url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(
    absoluteOutput,
    `${unique.map((row) => JSON.stringify(row)).join("\n")}${unique.length ? "\n" : ""}`,
  );

  const errorPath = `${absoluteOutput}.errors.json`;
  if (errors.length) writeFileSync(errorPath, `${JSON.stringify(errors, null, 2)}\n`);
  else if (existsSync(errorPath)) unlinkSync(errorPath);

  process.stderr.write(
    `${JSON.stringify({
      articles: articles.length,
      discovered,
      candidates: unique.length,
      errors: errors.length,
      tiktok: unique.filter((row) => row.source_platform === "TikTok").length,
      instagram: unique.filter((row) => row.source_platform === "Instagram").length,
      mapped: unique.filter((row) => row.catalog_match_status === "title_overlap").length,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
