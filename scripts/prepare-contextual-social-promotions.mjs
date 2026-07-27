#!/usr/bin/env node
/**
 * Build an approved contextual TikTok/Instagram promotion ledger from
 * review-only candidates. A row is promoted only when:
 *
 * 1. Final public post URL parses cleanly (no query string)
 * 2. oEmbed was verified
 * 3. oEmbed title/author contains the catalog meme title or a long alias
 *    (same strict rules as matchCatalogMeme — no article HTML, no pure digits)
 * 4. creator_name is present (oEmbed author)
 *
 * Output rows satisfy contextual-social-promotions-to-sql.mjs validation.
 * This never writes to Supabase; generate SQL and run it explicitly.
 *
 * Usage:
 *   node scripts/prepare-contextual-social-promotions.mjs \
 *     data/memes/collected data/memes/verified \
 *     data/memes/review/contextual-social-promotions-YYYY-MM-DD.jsonl
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseNativeSocialContent } from "./social-content.mjs";
import { matchCatalogMeme } from "./public-article-social.mjs";

const CANDIDATE_FILE =
  /^(?:tiktok-oembed|tiktok-newsroom|tiktok-public-search|instagram-oembed|instagram-public-page|tiktok-public-page|social-discovery|social-index-oembed|public-article-social|secondary-social|tertiary-|quaternary-|quinary-|korean-article-social).*\.jsonl$/i;

function jsonlFiles(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return extname(absolute) === ".jsonl" ? [absolute] : [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return []; // only top-level collected files
    return entry.isFile() && CANDIDATE_FILE.test(entry.name) ? [entryPath] : [];
  });
}

function loadCatalogMemes(dir) {
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
            needles: [title, ...aliases],
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

function compact(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function readCandidates(dir) {
  const byUrl = new Map();
  for (const file of jsonlFiles(dir).sort()) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const source = parseNativeSocialContent(row.source_url);
        if (!source || !["TikTok", "Instagram"].includes(source.platform)) continue;
        // Drop tracking query strings so SQL validation accepts the URL.
        const previous = byUrl.get(source.url);
        const weight =
          Number(Boolean(row.oembed_verified_at)) * 2 +
          Number(Boolean(row.oembed_title)) +
          Number(Boolean(row.oembed_author_name));
        const previousWeight =
          Number(Boolean(previous?.oembed_verified_at)) * 2 +
          Number(Boolean(previous?.oembed_title)) +
          Number(Boolean(previous?.oembed_author_name));
        if (!previous || weight >= previousWeight) {
          byUrl.set(source.url, {
            ...row,
            source_url: source.url,
            source_platform: source.platform,
            content_id: source.contentId,
            _from: file,
          });
        }
      } catch {
        // Skip bad rows.
      }
    }
  }
  return [...byUrl.values()];
}

function preparePromotion(row, memes) {
  const source = parseNativeSocialContent(row.source_url);
  if (!source || !["TikTok", "Instagram"].includes(source.platform)) return null;
  if (new URL(source.url).search) return null;

  const oembedTitle = String(row.oembed_title ?? row.title ?? "").trim();
  const creator = String(row.oembed_author_name ?? row.creator_name ?? "").trim();
  if (!oembedTitle || !creator || creator === "@") return null;

  const verifiedAt = row.oembed_verified_at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(verifiedAt))) return null;

  // Prefer explicit catalog title only when oEmbed metadata supports it.
  const matched =
    matchCatalogMeme(`${oembedTitle}\n${creator}`, memes) ??
    (row.meme_title
      ? matchCatalogMeme(
          `${oembedTitle}\n${creator}`,
          memes.filter((meme) => meme.title === row.meme_title),
        )
      : null);
  if (!matched) return null;

  // Require the meme headword (not only a weak alias) to appear in oEmbed text.
  const hay = compact(`${oembedTitle}\n${creator}`);
  const titleKey = compact(matched.title);
  const aliasKeys = (matched.aliases ?? [])
    .map(compact)
    .filter((key) => key.length >= 4 && !/^\d+$/.test(key));
  const strong =
    (titleKey.length >= 4 && hay.includes(titleKey)) ||
    aliasKeys.some((key) => key.length >= 6 && hay.includes(key));
  if (!strong) return null;

  return {
    meme_title: matched.title,
    source_platform: source.platform,
    source_url: source.url,
    content_id: source.contentId,
    title: oembedTitle.slice(0, 500),
    creator_name: creator.slice(0, 200),
    oembed_verified_at: verifiedAt,
    catalog_match_status: "exact",
    source_role: "contextual_derivative",
    rights_basis: "platform_public_embed",
    is_representative: false,
    promotion_status: "approved",
    review_note:
      "oEmbed title/author contains the catalog meme title or a long alias. Stored as non-representative contextual embed (platform public embed), not original source.",
  };
}

function main() {
  const [inputDir, verifiedDir, outputPath] = process.argv.slice(2);
  if (!inputDir || !verifiedDir || !outputPath) {
    console.error(
      "usage: node scripts/prepare-contextual-social-promotions.mjs <collected-dir> <verified-dir> <output.jsonl>",
    );
    process.exitCode = 2;
    return;
  }

  const memes = loadCatalogMemes(verifiedDir);
  const candidates = readCandidates(inputDir);
  const promotions = [];
  const seen = new Set();
  const rejected = { total: candidates.length, no_match: 0, weak: 0, missing_meta: 0, dup: 0 };

  for (const row of candidates) {
    const prepared = preparePromotion(row, memes);
    if (!prepared) {
      const hasMeta = Boolean(String(row.oembed_title ?? "").trim() && String(row.oembed_author_name ?? "").trim());
      if (!hasMeta) rejected.missing_meta++;
      else rejected.no_match++;
      continue;
    }
    if (seen.has(prepared.source_url)) {
      rejected.dup++;
      continue;
    }
    // One contextual embed per meme+platform keeps the detail page readable.
    const memeKey = `${prepared.meme_title}\u0000${prepared.source_platform}`;
    if (seen.has(memeKey)) {
      rejected.dup++;
      continue;
    }
    seen.add(prepared.source_url);
    seen.add(memeKey);
    promotions.push(prepared);
  }

  promotions.sort(
    (a, b) =>
      a.meme_title.localeCompare(b.meme_title, "ko") ||
      a.source_platform.localeCompare(b.source_platform) ||
      a.source_url.localeCompare(b.source_url),
  );

  const absolute = resolve(outputPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${promotions.map((row) => JSON.stringify(row)).join("\n")}${promotions.length ? "\n" : ""}`);

  process.stderr.write(
    `${JSON.stringify({
      candidates: candidates.length,
      promotions: promotions.length,
      tiktok: promotions.filter((row) => row.source_platform === "TikTok").length,
      instagram: promotions.filter((row) => row.source_platform === "Instagram").length,
      rejected,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { preparePromotion };
