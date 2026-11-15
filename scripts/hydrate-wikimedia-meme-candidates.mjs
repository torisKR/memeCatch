#!/usr/bin/env node
/**
 * Turn Wikimedia discovery candidates into complete, still-pending review
 * records. It reads only public Wikimedia introductions and never publishes or
 * writes to Supabase. The result is intended for the pending moderation queue.
 *
 * Usage:
 *   node scripts/hydrate-wikimedia-meme-candidates.mjs <input-dir> <output.jsonl>
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { memeTitleKey } from "./meme-title-key.mjs";

const [inputDir, outputPath] = process.argv.slice(2);
if (!inputDir || !outputPath) {
  console.error("usage: node scripts/hydrate-wikimedia-meme-candidates.mjs <input-dir> <output.jsonl>");
  process.exit(2);
}

const candidates = new Map();
for (const file of readdirSync(inputDir).filter((name) => name.startsWith("wikimedia-") && name.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(join(inputDir, file), "utf8").split("\n")) {
    const raw = line.trim();
    if (!raw) continue;
    const row = JSON.parse(raw);
    const key = memeTitleKey(row.title);
    if (!key || candidates.has(key)) continue;
    candidates.set(key, row);
  }
}

const rows = [];
const errors = [];
const values = [...candidates.values()];
// MediaWiki's extracts module returns at most 20 introductions per request.
const BATCH_SIZE = 20;

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function summaryFrom(extract, title) {
  const firstSentence = cleanText(extract).match(/^(.{1,240}?[.!?])(?:\s|$)/)?.[1];
  return firstSentence || `${title}의 유래와 확산 맥락을 검토 중인 밈 기록이에요.`;
}

async function fetchBatch(batch) {
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query",
    redirects: "1",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    exchars: "900",
    titles: batch.map((row) => row.title).join("|"),
    format: "json",
  }).toString();
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "CatchMemeCandidateCollector/1.0 (https://catchmeme.com; contact@catchmeme.com)",
      "accept-language": "en",
    },
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || !("query" in data)) {
    throw new Error(`Wikimedia introduction HTTP ${response.status}`);
  }
  return data.query;
}

for (let offset = 0; offset < values.length; offset += BATCH_SIZE) {
  const batch = values.slice(offset, offset + BATCH_SIZE);
  try {
    const query = await fetchBatch(batch);
    const redirects = new Map(
      (query.redirects ?? []).map((redirect) => [
        memeTitleKey(redirect.from),
        memeTitleKey(redirect.to),
      ])
    );
    const pages = Object.values(query.pages ?? {});
    const pagesByKey = new Map(
      pages
        .filter((page) => !page.missing && typeof page.title === "string" && typeof page.extract === "string")
        .map((page) => [memeTitleKey(page.title), page])
    );
    for (const candidate of batch) {
      const candidateKey = memeTitleKey(candidate.title);
      const page = pagesByKey.get(redirects.get(candidateKey) ?? candidateKey);
      const extract = cleanText(page?.extract);
      if (!extract) {
        errors.push({ title: candidate.title, message: "missing Wikimedia introduction" });
        continue;
      }
      const isViralVideo = candidate.candidate_source === "Wikimedia Category: Viral videos";
      rows.push({
        title: candidate.title,
        aliases: [],
        summary: summaryFrom(extract, candidate.title),
        description: extract,
        origin: `${candidate.origin_year}년 전후의 공개 Wikimedia 기록을 바탕으로 원본과 확산 맥락을 검수 중이에요.`,
        year: candidate.origin_year,
        category: isViralVideo ? "challenge" : "image",
        media_type: isViralVideo ? "video" : "image",
        platform: "Wikipedia",
        source_url: candidate.source_url,
        safety_level: "yellow",
        difficulty: "normal",
        sentiment: "funny",
        usage_note: "원본 업로드와 사용 맥락을 확인한 뒤에만 공개해요.",
        caution: null,
        review_status: "pending",
        collection_note:
          "Pending editorial review. The linked Wikipedia page is context only, not a verified original upload.",
      });
    }
    process.stderr.write(`hydrated ${Math.min(offset + batch.length, values.length)}/${values.length}\n`);
  } catch (error) {
    for (const candidate of batch) {
      errors.push({ title: candidate.title, message: error instanceof Error ? error.message : String(error) });
    }
    process.stderr.write(`failed ${Math.min(offset + batch.length, values.length)}/${values.length}\n`);
  }
  if (offset + BATCH_SIZE < values.length) await new Promise((done) => setTimeout(done, 1_000));
}

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
if (errors.length > 0) {
  writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
}
process.stderr.write(`${JSON.stringify({ candidates: values.length, hydrated: rows.length, errors: errors.length })}\n`);
