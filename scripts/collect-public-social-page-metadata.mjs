#!/usr/bin/env node
/**
 * Enrich review-only TikTok and Instagram candidates from metadata exposed by
 * their public post pages. This uses no app API, login, cookie, private
 * endpoint, challenge bypass, or media download. It stores only a small set of
 * public text metadata fields and never publishes candidates to Supabase.
 *
 * Usage:
 *   node scripts/collect-public-social-page-metadata.mjs <input.jsonl> <output.jsonl> [--max=100]
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseNativeSocialContent } from "./social-content.mjs";
import {
  instagramEmbedMetadataFromHtml,
  looksLikeAccessChallenge,
  publicSocialMetadataFromHtml,
} from "./social-public-page-metadata.mjs";

const MAX_HTML_BYTES = 1_000_000;

function readCandidates(path, max) {
  const rows = [];
  const seen = new Set();
  for (const line of readFileSync(resolve(path), "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const source = parseNativeSocialContent(row.source_url);
      if (!source || !["TikTok", "Instagram"].includes(source.platform) || seen.has(source.url)) continue;
      seen.add(source.url);
      rows.push({ ...row, source_url: source.url, source_platform: source.platform, content_id: source.contentId });
      if (rows.length >= max) break;
    } catch {
      // Malformed input is never turned into a candidate.
    }
  }
  return rows;
}

async function readLimitedHtml(response) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_HTML_BYTES) throw new Error("public page exceeded metadata size limit");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("public page exceeded metadata size limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function publicMetadataUrl(source) {
  if (source.platform === "Instagram") return `${source.url}embed/captioned/`;
  return source.url;
}

function responseMatchesSource(responseUrl, source) {
  try {
    const url = new URL(responseUrl);
    if (source.platform === "Instagram") {
      return /(^|\.)instagram\.com$/i.test(url.hostname)
        && url.pathname === new URL(`${source.url}embed/captioned/`).pathname;
    }
    return parseNativeSocialContent(url.toString())?.url === source.url;
  } catch {
    return false;
  }
}

async function fetchPublicMetadata(source) {
  const response = await fetch(publicMetadataUrl(source), {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
    throw new Error(`public page HTTP ${response.status}`);
  }
  if (!responseMatchesSource(response.url, source)) throw new Error("public page redirected outside the canonical post URL");
  const html = await readLimitedHtml(response);
  const metadata = source.platform === "Instagram"
    ? instagramEmbedMetadataFromHtml(html)
    : publicSocialMetadataFromHtml(html);
  if (!metadata.title && !metadata.description && !metadata.author_name && looksLikeAccessChallenge(html)) {
    throw new Error("public page requested login or a challenge; stopping without bypass");
  }
  if (!metadata.title && !metadata.description && !metadata.author_name) throw new Error("public page exposed no usable metadata");
  return metadata;
}

async function sleep(milliseconds) {
  await new Promise((done) => setTimeout(done, milliseconds));
}

export async function collectPublicSocialPageMetadata(inputPath, outputPath, max = 100) {
  if (!existsSync(resolve(inputPath))) throw new Error(`input was not found: ${inputPath}`);
  const safeMax = Number.isFinite(max) ? Math.max(1, Math.min(1_000, Math.floor(max))) : 100;
  const rows = readCandidates(inputPath, safeMax);
  const results = [];
  const errors = [];
  for (const [index, row] of rows.entries()) {
    try {
      const source = parseNativeSocialContent(row.source_url);
      if (!source) throw new Error("candidate URL was not canonical");
      const metadata = await fetchPublicMetadata(source);
      results.push({
        ...row,
        public_page_title: metadata.title,
        public_page_description: metadata.description,
        public_page_author_name: metadata.author_name,
        public_page_thumbnail_available: Boolean(metadata.thumbnail_url),
        public_page_verified_at: new Date().toISOString(),
        review_status: "needs_human_source_match",
        collection_note: "Public post/embed-page metadata only; verify relevance, originality, and rights before publishing.",
      });
    } catch (error) {
      errors.push({ source_url: row.source_url, message: error instanceof Error ? error.message : String(error) });
    }
    if (index < rows.length - 1) await sleep(750);
  }

  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), `${results.map((row) => JSON.stringify(row)).join("\n")}${results.length ? "\n" : ""}`);
  const errorPath = resolve(`${outputPath}.errors.json`);
  if (errors.length) writeFileSync(errorPath, `${JSON.stringify(errors, null, 2)}\n`);
  else if (existsSync(errorPath)) unlinkSync(errorPath);
  return { candidates: rows.length, enriched: results.length, errors: errors.length };
}

async function main() {
  const [inputPath, outputPath, ...args] = process.argv.slice(2);
  const maxArg = args.find((arg) => arg.startsWith("--max="));
  const requestedMax = Number(maxArg?.slice(6) ?? 100);
  const max = Number.isFinite(requestedMax) ? requestedMax : 100;
  if (!inputPath || !outputPath) {
    console.error("usage: node scripts/collect-public-social-page-metadata.mjs <input.jsonl> <output.jsonl> [--max=100]");
    process.exitCode = 2;
    return;
  }
  const summary = await collectPublicSocialPageMetadata(inputPath, outputPath, max);
  process.stderr.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
