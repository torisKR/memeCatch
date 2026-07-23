#!/usr/bin/env node
/**
 * 기존 출처 정규화 백필 (재실행 가능 / idempotent)
 *
 * meme_contents(embed) + meme_sources의 YouTube/Shorts/TikTok/Instagram URL을
 * media_sources + meme_media 원장으로 옮긴다.
 *
 * - 이미 게시된 행은 운영자가 한 번 검수한 것이므로 review_state='approved'로 기록.
 *   단 source_role은 'usage_example'로 둔다 — 'original' 표시는 재검수가 필요하다.
 * - 임베드 게시 행은 rights_basis='official_embed', 링크만 있는 행은 'link_only'.
 * - meme_contents의 content_id/URL도 정규 형태로 맞춘다(재확인 잡 동기화 기준).
 *
 * 사용: node scripts/backfill-media-sources.mjs [--dry-run]
 */
import { createRestClient, restAll } from "./source-pipeline-rest.mjs";
import { DISPLAY_PLATFORM, normalizeSourceUrl } from "./source-url.mjs";

const DRY = process.argv.includes("--dry-run");
const rest = createRestClient();

const PLATFORM_DISPLAY_TO_KEY = {
  YouTube: "youtube",
  "YouTube Shorts": "youtube_shorts",
  TikTok: "tiktok",
  Instagram: "instagram",
};

async function ensureMediaSources(candidates) {
  // 기존 행을 먼저 읽어 URL→id 맵을 만들고, 없는 것만 추가한다(기존 메타데이터 보존).
  const byUrl = new Map();
  const existing = await restAll(
    rest,
    "media_sources?select=id,platform,external_id,canonical_url"
  );
  for (const row of existing) byUrl.set(row.canonical_url, row);

  // 같은 영상이 여러 밈에 연결될 수 있으므로 (platform, externalId) 기준으로 중복을 제거한다.
  const seen = new Set();
  const missing = candidates.filter((c) => {
    const key = `${c.platform}${c.externalId}`;
    if (byUrl.has(c.canonicalUrl) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (missing.length && !DRY) {
    // 500건씩 나누어 삽입한다.
    for (let i = 0; i < missing.length; i += 500) {
      const batch = missing.slice(i, i + 500).map((c) => ({
        platform: c.platform,
        external_id: c.externalId,
        canonical_url: c.canonicalUrl,
        title: c.title ?? null,
        channel_name: c.channelName ?? null,
        thumbnail_url: c.thumbnailUrl ?? null,
        embeddable: c.embeddable ?? null,
      }));
      const inserted = await rest("media_sources?on_conflict=canonical_url", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
        body: JSON.stringify(batch),
      });
      for (const row of inserted ?? []) byUrl.set(row.canonical_url, row);
    }
    // ignore-duplicates로 걸러진 행이 있으면 다시 읽어 맵을 완성한다.
    if (byUrl.size < existing.length + missing.length) {
      const refreshed = await restAll(
        rest,
        "media_sources?select=id,platform,external_id,canonical_url"
      );
      for (const row of refreshed) byUrl.set(row.canonical_url, row);
    }
  }
  return byUrl;
}

async function linkMemeMedia(pairs) {
  if (!pairs.length || DRY) return;
  for (let i = 0; i < pairs.length; i += 500) {
    await rest("meme_media", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify(pairs.slice(i, i + 500)),
    });
  }
}

const stats = { contents: 0, sources: 0, skipped: 0, linked: 0, patched: 0 };

// ── 1) meme_contents(embed) → 원장 ─────────────────────────────
const contents = await restAll(
  rest,
  "meme_contents?select=id,meme_id,platform,content_id,url,thumbnail_url,caption,availability,type&type=eq.embed"
);
const candidates = [];
const contentPairs = [];
const patches = [];

for (const row of contents) {
  if (!PLATFORM_DISPLAY_TO_KEY[row.platform ?? ""]) continue;
  // URL이 없으면 platform+content_id로 복원한다.
  const fallbackUrl =
    row.platform === "TikTok" || row.platform === "Instagram"
      ? null // 계정 경로를 알 수 없으면 URL 복원 불가
      : row.content_id
        ? row.platform === "YouTube Shorts"
          ? `https://www.youtube.com/shorts/${row.content_id}`
          : `https://www.youtube.com/watch?v=${row.content_id}`
        : null;
  const normalized = normalizeSourceUrl(row.url ?? fallbackUrl ?? "");
  if (!normalized) {
    stats.skipped += 1;
    continue;
  }
  stats.contents += 1;
  candidates.push({
    ...normalized,
    title: row.caption,
    thumbnailUrl: row.thumbnail_url,
    embeddable: row.availability !== "dead",
  });
  contentPairs.push({ memeId: row.meme_id, normalized });
  // 재확인 잡은 (platform, content_id)로 meme_contents를 찾는다 — 비어 있으면 맞춰둔다.
  if (row.content_id !== normalized.externalId || row.url !== normalized.canonicalUrl) {
    patches.push({
      id: row.id,
      content_id: normalized.externalId,
      url: normalized.canonicalUrl,
    });
  }
}

const byUrl = await ensureMediaSources(candidates);
const ledgerRows = contentPairs.flatMap(({ memeId, normalized }) => {
  const source = byUrl.get(normalized.canonicalUrl);
  if (!source) return [];
  stats.linked += 1;
  return [
    {
      meme_id: memeId,
      source_id: source.id,
      source_role: "usage_example",
      rights_basis: "official_embed",
      review_state: "approved",
      reviewed_at: new Date().toISOString(),
    },
  ];
});
await linkMemeMedia(ledgerRows);

// ── 2) meme_sources 링크만 있는 출처 → 원장 ────────────────────
const links = await restAll(
  rest,
  "meme_sources?select=id,meme_id,platform,source_url,title,creator_name&source_url=not.is.null"
);
const linkCandidates = [];
const linkPairs = [];
for (const row of links) {
  const normalized = normalizeSourceUrl(row.source_url ?? "");
  if (!normalized) continue;
  stats.sources += 1;
  linkCandidates.push({
    ...normalized,
    title: row.title,
    channelName: row.creator_name,
  });
  linkPairs.push({ memeId: row.meme_id, normalized });
}
const linkByUrl = await ensureMediaSources(linkCandidates);
const linkLedger = linkPairs.flatMap(({ memeId, normalized }) => {
  const source = linkByUrl.get(normalized.canonicalUrl);
  if (!source) return [];
  return [
    {
      meme_id: memeId,
      source_id: source.id,
      source_role: "usage_example",
      rights_basis: "link_only",
      review_state: "approved",
      reviewed_at: new Date().toISOString(),
    },
  ];
});
await linkMemeMedia(linkLedger);

// ── 3) meme_contents 정규화 패치 ───────────────────────────────
if (!DRY) {
  for (const patch of patches) {
    await rest(`meme_contents?id=eq.${patch.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content_id: patch.content_id, url: patch.url }),
    });
    stats.patched += 1;
  }
}

console.log(
  JSON.stringify({
    dryRun: DRY,
    embedContents: stats.contents,
    sourceLinks: stats.sources,
    skipped: stats.skipped,
    memeMediaLinked: stats.linked + linkLedger.length,
    contentsPatched: DRY ? patches.length : stats.patched,
  })
);
