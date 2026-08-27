#!/usr/bin/env node
/**
 * 후보 JSONL → 출처 검수 큐(media_sources + meme_media pending) 적재.
 *
 * TikTok/Instagram은 공개 검색 API가 없어, 기존 oEmbed 수집기가 검증한
 * 후보 JSONL을 그대로 검수 큐에 올린다. YouTube 후보 JSONL도 같은 형식이면 된다.
 *
 * 입력 형식(한 줄당 하나):
 *   {"meme_title": "심쿵", "source_url": "https://www.tiktok.com/@.../video/..."}
 *   {"meme_id": "uuid", "source_url": "https://youtu.be/...", "note": "제보"}
 *
 * 사용: node scripts/import-source-candidates.mjs <candidates.jsonl> [--dry-run]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRestClient, restAll } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

const [inputPath, ...args] = process.argv.slice(2);
const DRY = args.includes("--dry-run");
if (!inputPath || !existsSync(resolve(inputPath))) {
  console.error("usage: node scripts/import-source-candidates.mjs <candidates.jsonl> [--dry-run]");
  process.exit(2);
}
const rest = createRestClient();

function firstText(maxLength, ...values) {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim());
  return value ? value.slice(0, maxLength) : null;
}

const seeds = [];
for (const line of readFileSync(resolve(inputPath), "utf8").split("\n")) {
  if (!line.trim()) continue;
  try {
    seeds.push(JSON.parse(line));
  } catch {
    // 깨진 줄은 후보로 만들지 않는다.
  }
}

// 제목 → 밈 id 해석용 맵
const memes = await restAll(rest, "memes?select=id,title,aliases");
const byTitle = new Map();
for (const meme of memes ?? []) {
  byTitle.set(String(meme.title).replace(/\s+/g, "").toLowerCase(), meme.id);
  for (const alias of meme.aliases ?? []) {
    byTitle.set(String(alias).replace(/\s+/g, "").toLowerCase(), meme.id);
  }
}

const stats = { rows: seeds.length, valid: 0, noMeme: 0, badUrl: 0, linked: 0, dupMedia: 0 };
// 같은 미디어가 /p/·/reel/ 등 다른 URL로 들어오는 경우 (platform, externalId) 중복 제거.
// 단, 서로 다른 밈에 연결되는 것은 허용해야 하므로 (memeId, platform, externalId)로 제한한다.
const seenPair = new Set();

for (const seed of seeds) {
  const memeId =
    typeof seed.meme_id === "string"
      ? seed.meme_id
      : byTitle.get(String(seed.meme_title ?? "").replace(/\s+/g, "").toLowerCase());
  if (!memeId) {
    stats.noMeme += 1;
    continue;
  }
  const normalized = normalizeSourceUrl(seed.source_url ?? "");
  if (!normalized) {
    stats.badUrl += 1;
    continue;
  }
  const pairKey = `${memeId}${normalized.platform}${normalized.externalId}`;
  if (seenPair.has(pairKey)) {
    stats.dupMedia += 1;
    continue;
  }
  seenPair.add(pairKey);
  stats.valid += 1;
  if (DRY) {
    console.log(`[dry-run] ${seed.meme_title ?? memeId} ← ${normalized.canonicalUrl}`);
    continue;
  }

  // 기존 행의 메타데이터를 덮지 않도록 신규만 삽입하고, 충돌 시 id만 다시 읽는다.
  let source = null;
  try {
    const inserted = await rest("media_sources?on_conflict=canonical_url", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        platform: normalized.platform,
        external_id: normalized.externalId,
        canonical_url: normalized.canonicalUrl,
        title: firstText(500, seed.video_title, seed.oembed_title),
        channel_name: firstText(200, seed.channel, seed.oembed_author_name),
      }),
    });
    source = Array.isArray(inserted) ? inserted[0] : inserted;
  } catch {
    // (platform, external_id) 충돌: 동일 미디어가 다른 canonical_url로 존재 → 기존 행 재사용
  }
  if (!source?.id) {
    const existing = await rest(
      `media_sources?select=id&or=(canonical_url.eq.${encodeURIComponent(normalized.canonicalUrl)},and(platform.eq.${normalized.platform},external_id.eq.${normalized.externalId}))&limit=1`
    );
    source = Array.isArray(existing) ? existing[0] : existing;
  }
  if (!source?.id) continue;

  const linked = await rest("meme_media", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({
      meme_id: memeId,
      source_id: source.id,
      source_role: "usage_example",
      rights_basis: "unknown",
      review_state: "pending",
      reviewer_note:
        typeof seed.note === "string"
          ? seed.note.slice(0, 500)
          : typeof seed.collection_note === "string"
            ? seed.collection_note.slice(0, 500)
            : null,
    }),
  });
  if (!(Array.isArray(linked) ? linked[0] : linked)) {
    stats.dupMedia += 1;
    continue;
  }
  stats.linked += 1;
  if (stats.linked % 200 === 0) {
    console.error(`진행: 연결 ${stats.linked} / 전체 ${stats.rows}`);
  }
}

console.log(JSON.stringify({ dryRun: DRY, ...stats }));
