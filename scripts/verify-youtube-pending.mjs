#!/usr/bin/env node
/**
 * 검수 대기 YouTube/Shorts 출처 중 API 미검증(embeddable IS NULL)분을
 * videos.list 배치로 검증한다.
 * - 공개+임베드 가능 → 메타데이터 채우고 embeddable=true
 * - 비공개/임베드 불가 → embeddable=false (자동 승인 대상에서 제외)
 * - 조회 불가 → removed_at (제목·썸네일 캐시 삭제)
 *
 * 사용: node scripts/verify-youtube-pending.mjs [--limit=3000] [--dry-run]
 */
import { createRestClient, restAll, loadEnv } from "./source-pipeline-rest.mjs";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = Math.max(50, Number(limitArg?.slice(8) ?? 3000));
const DRY = args.includes("--dry-run");

const env = loadEnv();
const API_KEY = env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY 누락");
  process.exit(1);
}
const rest = createRestClient(env);

function parseDuration(value) {
  const m = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

// 검수 대기(pending)로 연결된 미검증 YouTube 출처만 가져온다.
const pendingLinks = await restAll(
  rest,
  "meme_media?select=source_id&review_state=eq.pending"
);
const pendingIds = new Set(pendingLinks.map((r) => r.source_id));

const sources = (
  await restAll(
    rest,
    "media_sources?select=id,platform,external_id&platform=in.(youtube,youtube_shorts)&embeddable=is.null&removed_at=is.null"
  )
).filter((s) => pendingIds.has(s.id) && s.external_id);
const targets = sources.slice(0, LIMIT);
console.error(`미검증 YouTube 후보 ${sources.length}건 중 ${targets.length}건 검사`);

const now = new Date().toISOString();
const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
const stats = { checked: 0, verified: 0, unembeddable: 0, removed: 0, apiCalls: 0 };

for (let i = 0; i < targets.length; i += 50) {
  const batch = targets.slice(i, i + 50);
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    part: "snippet,status,contentDetails",
    id: batch.map((s) => s.external_id).join(","),
    key: API_KEY,
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`videos.list HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  stats.apiCalls += 1;
  const byId = new Map((data.items ?? []).map((item) => [item.id, item]));

  for (const source of batch) {
    const video = byId.get(source.external_id);
    stats.checked += 1;
    if (!video) {
      stats.removed += 1;
      if (!DRY) {
        await rest(`media_sources?id=eq.${source.id}`, {
          method: "PATCH",
          body: JSON.stringify({ removed_at: now, last_checked_at: now, title: null, thumbnail_url: null }),
        });
      }
      continue;
    }
    const embeddable =
      video.status?.privacyStatus === "public" && video.status?.embeddable === true;
    if (embeddable) stats.verified += 1;
    else stats.unembeddable += 1;
    if (!DRY) {
      const thumbnails = video.snippet?.thumbnails ?? {};
      await rest(`media_sources?id=eq.${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: video.snippet?.title ?? null,
          channel_name: video.snippet?.channelTitle ?? null,
          channel_id: video.snippet?.channelId ?? null,
          platform_published_at: video.snippet?.publishedAt ?? null,
          duration_seconds: parseDuration(video.contentDetails?.duration),
          public_status: video.status?.privacyStatus ?? "unknown",
          embeddable,
          license_code: video.status?.license ?? null,
          made_for_kids: video.status?.madeForKids ?? null,
          thumbnail_url:
            thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
          metadata_refreshed_at: now,
          metadata_expires_at: expires,
          last_checked_at: now,
        }),
      });
    }
  }
  console.error(`진행 ${Math.min(i + 50, targets.length)}/${targets.length}`);
}

console.log(JSON.stringify({ dryRun: DRY, ...stats }));
