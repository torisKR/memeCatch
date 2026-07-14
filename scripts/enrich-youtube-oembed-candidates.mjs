#!/usr/bin/env node
/**
 * Add public YouTube oEmbed title/author metadata to review-only candidates.
 * This uses no API key, account login, video download, or Supabase write and
 * never treats embeddability as publication approval.
 *
 * Usage:
 *   node scripts/enrich-youtube-oembed-candidates.mjs <input.jsonl> <output.jsonl> [--priority=high] [--max=50]
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseNativeSocialContent } from "./social-content.mjs";

const [inputPath, outputPath, ...args] = process.argv.slice(2);
const priority = args.find((arg) => arg.startsWith("--priority="))?.slice(11) ?? "high";
const requestedMax = Number(args.find((arg) => arg.startsWith("--max="))?.slice(6) ?? 50);
const max = Number.isFinite(requestedMax)
  ? Math.max(1, Math.min(500, Math.floor(requestedMax)))
  : 50;

if (!inputPath || !outputPath) {
  console.error("usage: node scripts/enrich-youtube-oembed-candidates.mjs <input.jsonl> <output.jsonl> [--priority=high] [--max=50]");
  process.exit(2);
}
if (!existsSync(resolve(inputPath))) {
  console.error(`input was not found: ${inputPath}`);
  process.exit(2);
}

function candidates(path) {
  const rows = [];
  const seen = new Set();
  for (const line of readFileSync(resolve(path), "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const source = parseNativeSocialContent(row.source_url);
      if (
        !source ||
        source.platform !== "YouTube" ||
        !source.isShort ||
        row.source_platform !== "YouTube Shorts" ||
        row.review_priority !== priority ||
        seen.has(source.url)
      ) continue;
      seen.add(source.url);
      rows.push({ ...row, source_url: source.url });
      if (rows.length >= max) break;
    } catch {
      // Malformed rows never become review candidates.
    }
  }
  return rows;
}

async function publicOEmbed(sourceUrl) {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", sourceUrl);
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, {
    headers: { "user-agent": "CatchMemeSourceCollector/1.0 (+https://catchmeme.com)" },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || data.provider_name !== "YouTube") {
    throw new Error(`YouTube oEmbed HTTP ${response.status}`);
  }
  return {
    title: typeof data.title === "string" ? data.title.trim().slice(0, 500) : null,
    author: typeof data.author_name === "string" ? data.author_name.trim().slice(0, 200) : null,
  };
}

async function sleep(milliseconds) {
  await new Promise((done) => setTimeout(done, milliseconds));
}

const input = candidates(inputPath);
const results = [];
const errors = [];
for (const [index, row] of input.entries()) {
  try {
    const metadata = await publicOEmbed(row.source_url);
    results.push({
      ...row,
      oembed_title: metadata.title,
      oembed_author_name: metadata.author,
      oembed_verified_at: new Date().toISOString(),
      review_status: "needs_human_source_match",
      collection_note: "Public YouTube oEmbed metadata only; verify originality, authorization, and scene match before publishing.",
    });
  } catch (error) {
    errors.push({ source_url: row.source_url, message: error instanceof Error ? error.message : String(error) });
  }
  if (index < input.length - 1) await sleep(250);
}

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${results.map((row) => JSON.stringify(row)).join("\n")}${results.length ? "\n" : ""}`);
const errorPath = resolve(`${outputPath}.errors.json`);
if (errors.length) writeFileSync(errorPath, `${JSON.stringify(errors, null, 2)}\n`);
else if (existsSync(errorPath)) unlinkSync(errorPath);
process.stderr.write(`${JSON.stringify({ candidates: input.length, enriched: results.length, errors: errors.length })}\n`);
