#!/usr/bin/env node
/**
 * 기존 YouTube/Shorts 출처 일괄 상태 재확인 (문서 2단계).
 *
 * 검색 API는 쓰지 않고 videos.list 배치(50개/호출)만 사용한다.
 * - 조회되지 않는 영상 → removed_at + 제목·썸네일 캐시 삭제 + 공개 임베드 내림
 * - 임베드 불가 → meme_contents availability='dead' (공개 화면 자동 숨김)
 * - 성공 메타데이터는 30일 갱신 시한을 찍는다(YouTube API 저장 정책).
 *
 * 사용: node scripts/refresh-youtube-sources.mjs [--limit=500] [--dry-run]
 * 필요 환경변수: YOUTUBE_API_KEY (+ Supabase service role)
 */
import { createRestClient, restAll, loadEnv } from "./source-pipeline-rest.mjs";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = Math.max(50, Number(limitArg?.slice(8) ?? 2000));
const DRY = args.includes("--dry-run");

const env = loadEnv();
const API_KEY = env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY 누락 (.env.local 또는 환경변수)");
  process.exit(1);
}
const rest = createRestClient(env);

const DISPLAY_PLATFORM = { youtube: "YouTube", youtube_shorts: "YouTube Shorts" };

function parseDuration(value) {
  const m = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const sources = await restAll(
  rest,
  "media_sources?select=id,platform,external_id,canonical_url&platform=in.(youtube,youtube_shorts)&removed_at=is.null&order=last_checked_at.asc.nullsfirst"
);
const targets = sources.slice(0, LIMIT);
console.error(`대상 ${targets.length} / 전체 ${sources.length}`);

const now = new Date().toISOString();
const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
const stats = { checked: 0, removed: 0, hidden: 0, apiCalls: 0 };

async function syncAvailability(source, availability) {
  if (DRY) return;
  await rest(
    `meme_contents?platform=eq.${encodeURIComponent(DISPLAY_PLATFORM[source.platform])}&content_id=eq.${source.external_id}&type=eq.embed`,
    { method: "PATCH", body: JSON.stringify({ availability }) }
  );
}

for (let i = 0; i < targets.length; i += 50) {
  const batch = targets.slice(i, i + 50);
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    part: "snippet,status,contentDetails",
    id: batch.map((s) => s.external_id).filter(Boolean).join(","),
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
          body: JSON.stringify({
            removed_at: now,
            last_checked_at: now,
            title: null,
            thumbnail_url: null,
            metadata_expires_at: null,
          }),
        });
      }
      await syncAvailability(source, "dead");
      continue;
    }

    const embeddable =
      video.status?.privacyStatus === "public" && video.status?.embeddable === true;
    const blockedKr = video.contentDetails?.regionRestriction?.blocked?.includes("KR") === true;
    const thumbnails = video.snippet?.thumbnails ?? {};

    if (!DRY) {
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
    if (!embeddable) {
      stats.hidden += 1;
      await syncAvailability(source, "dead");
    } else if (blockedKr) {
      await syncAvailability(source, "region_blocked");
    } else {
      await syncAvailability(source, "live");
    }
  }
  console.error(`진행 ${Math.min(i + 50, targets.length)}/${targets.length}`);
}

console.log(JSON.stringify({ dryRun: DRY, ...stats }));
