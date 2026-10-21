#!/usr/bin/env node
/**
 * 운영자가 확보한 Instagram/TikTok 공개 URL을 검수 대기열에 제한적으로 등록한다.
 * 기본은 계획 모드이며 provider 호출이나 DB 쓰기를 하지 않는다.
 * 실행은 `--execute --limit=1 --meme-id=<uuid>`로 단일 밈·단일 후보에만 허용한다.
 */
import { closeSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRestClient, restAll as defaultRestAll, loadEnv } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

const MAX_LIMIT = 2;
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_INPUT_LINES = 1_000;
const MAX_LINE_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const ELIGIBLE_MODERATION = new Set(["approved", "limited"]);

function parseLimit(value, fallback = MAX_LIMIT) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new Error(`--limit must be an integer from 1 to ${MAX_LIMIT}`);
  }
  return parsed;
}

export function parseArgs(argv) {
  let inputPath = null;
  let execute = false;
  let memeId = null;
  let limit = MAX_LIMIT;
  let hasLimit = false;
  const seen = new Set();
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      if (inputPath !== null) throw new Error("exactly one JSONL input path is required");
      inputPath = arg;
      continue;
    }
    const key = arg.startsWith("--limit=")
      ? "--limit"
      : arg.startsWith("--meme-id=")
        ? "--meme-id"
        : arg;
    if (!["--execute", "--limit", "--meme-id"].includes(key) || seen.has(key)) {
      throw new Error(`Unknown or repeated argument: ${arg}`);
    }
    seen.add(key);
    if (key === "--execute") execute = true;
    if (key === "--limit") {
      hasLimit = true;
      limit = parseLimit(arg.slice("--limit=".length));
    }
    if (key === "--meme-id") {
      memeId = arg.slice("--meme-id=".length);
      if (!UUID_PATTERN.test(memeId)) throw new Error("--meme-id must be a UUID");
    }
  }
  if (!inputPath) throw new Error("a JSONL input path is required");
  if (execute && (!hasLimit || limit !== 1 || !memeId)) {
    throw new Error("--execute requires --limit=1 and --meme-id=<uuid>");
  }
  return { inputPath, execute, limit, memeId };
}

export function parseCandidateText(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES) {
    throw new Error(`input must be at most ${MAX_INPUT_BYTES} bytes`);
  }
  const lines = text.split("\n");
  if (lines.length > MAX_INPUT_LINES) throw new Error(`input must be at most ${MAX_INPUT_LINES} lines`);
  const rows = [];
  let malformed = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
      malformed += 1;
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) malformed += 1;
      else rows.push(parsed);
    } catch {
      malformed += 1;
    }
  }
  return { rows, malformed };
}

function candidateFromSeed(seed, scopedMemeId) {
  if (typeof seed.meme_id !== "string" || seed.meme_id !== scopedMemeId) return null;
  const normalized = normalizeSourceUrl(seed.source_url ?? "");
  if (!normalized || !["instagram", "tiktok"].includes(normalized.platform)) return null;
  return {
    memeId: scopedMemeId,
    platform: normalized.platform,
    externalId: normalized.externalId,
    canonicalUrl: normalized.canonicalUrl,
    reviewerNote: typeof seed.note === "string" && seed.note.trim()
      ? seed.note.trim().slice(0, 500)
      : null,
  };
}

function pairKey(candidate) {
  return `${candidate.memeId}\u0000${candidate.platform}\u0000${candidate.externalId}`;
}

async function readExactEligibleMeme({ rest, restAll, memeId }) {
  if (!UUID_PATTERN.test(memeId ?? "")) return null;
  const rows = await restAll(
    rest,
    `memes?select=id,doc_class,moderation_status,category,media_type&id=eq.${encodeURIComponent(memeId)}&limit=2`,
  );
  if (rows.length !== 1) return null;
  const meme = rows[0];
  return (
    meme.id === memeId &&
    meme.doc_class === "meme" &&
    meme.category !== "phrase" &&
    (meme.media_type === "video" || meme.media_type === "embed") &&
    ELIGIBLE_MODERATION.has(meme.moderation_status)
  )
    ? meme
    : null;
}

async function existingIdentity({ rest, restAll, candidate }) {
  const identityRows = await restAll(
    rest,
    `media_sources?select=id,platform,external_id,canonical_url&platform=eq.${candidate.platform}&external_id=eq.${encodeURIComponent(candidate.externalId)}&limit=2`,
  );
  if (identityRows.length > 0) return true;
  const canonicalRows = await restAll(
    rest,
    `media_sources?select=id,platform,external_id,canonical_url&canonical_url=eq.${encodeURIComponent(candidate.canonicalUrl)}&limit=2`,
  );
  return canonicalRows.length > 0;
}

export async function importSourceCandidates({
  rest,
  restAll = defaultRestAll,
  seeds,
  malformed = 0,
  execute = false,
  limit = MAX_LIMIT,
  memeId,
}) {
  const boundedLimit = parseLimit(limit);
  if (execute && (boundedLimit !== 1 || !UUID_PATTERN.test(memeId ?? ""))) {
    throw new Error("candidate execution requires one UUID-scoped meme");
  }
  const stats = {
    mode: execute ? "execute" : "plan",
    rows: seeds.length,
    malformed,
    selected: 0,
    invalid: 0,
    ineligibleMeme: 0,
    duplicateInput: 0,
    duplicateStored: 0,
    wouldInsert: 0,
    inserted: 0,
    linked: 0,
    dbWrites: 0,
    providerCalls: 0,
  };
  if (!UUID_PATTERN.test(memeId ?? "")) {
    stats.ineligibleMeme = 1;
    return stats;
  }
  const meme = await readExactEligibleMeme({ rest, restAll, memeId });
  if (!meme) {
    stats.ineligibleMeme = 1;
    return stats;
  }
  const seen = new Set();
  const candidates = [];
  for (const seed of seeds) {
    const candidate = candidateFromSeed(seed, memeId);
    if (!candidate) {
      stats.invalid += 1;
      continue;
    }
    const key = pairKey(candidate);
    if (seen.has(key)) {
      stats.duplicateInput += 1;
      continue;
    }
    seen.add(key);
    candidates.push(candidate);
    if (candidates.length >= boundedLimit) break;
  }
  stats.selected = candidates.length;
  for (const candidate of candidates) {
    if (await existingIdentity({ rest, restAll, candidate })) {
      stats.duplicateStored += 1;
      continue;
    }
    stats.wouldInsert += 1;
    if (!execute) continue;
    const inserted = await rest("media_sources?on_conflict=canonical_url", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        platform: candidate.platform,
        external_id: candidate.externalId,
        canonical_url: candidate.canonicalUrl,
      }),
    });
    stats.dbWrites += 1;
    const source = Array.isArray(inserted) ? inserted[0] : inserted;
    if (!(
      source?.id &&
      source.platform === candidate.platform &&
      source.external_id === candidate.externalId &&
      source.canonical_url === candidate.canonicalUrl
    )) {
      stats.duplicateStored += 1;
      continue;
    }
    stats.inserted += 1;
    const linked = await rest("meme_media", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        meme_id: candidate.memeId,
        source_id: source.id,
        source_role: "usage_example",
        rights_basis: "unknown",
        review_state: "pending",
        reviewer_note: candidate.reviewerNote,
      }),
    });
    stats.dbWrites += 1;
    if (Array.isArray(linked) ? linked[0] : linked) stats.linked += 1;
    else stats.duplicateStored += 1;
  }
  return stats;
}

export function readBoundedInput(inputPath) {
  const absolute = resolve(inputPath);
  let descriptor;
  try {
    descriptor = openSync(absolute, "r");
  } catch {
    throw new Error("input file does not exist or cannot be read");
  }
  try {
    const buffer = Buffer.allocUnsafe(MAX_INPUT_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const bytesRead = readSync(descriptor, buffer, total, buffer.length - total, null);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > MAX_INPUT_BYTES) throw new Error(`input must be at most ${MAX_INPUT_BYTES} bytes`);
    return parseCandidateText(buffer.subarray(0, total).toString("utf8"));
  } finally {
    closeSync(descriptor);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const input = readBoundedInput(options.inputPath);
  const env = loadEnv();
  const rest = createRestClient(env);
  const stats = await importSourceCandidates({
    rest,
    seeds: input.rows,
    malformed: input.malformed,
    execute: options.execute,
    limit: options.limit,
    memeId: options.memeId,
  });
  console.log(JSON.stringify(stats));
  return stats;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "source candidate import failed");
    process.exitCode = 1;
  });
}
