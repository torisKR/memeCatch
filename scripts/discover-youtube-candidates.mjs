#!/usr/bin/env node
/**
 * YouTube Data API 후보 발견 → 출처 검수 큐 적재.
 *
 * 원본이 하나도 없는 승인 밈부터 trend_score 순으로 검색한다.
 * - search.list(후보 ID) → videos.list(공개·임베드 확인) 순서로만 사용한다.
 * - 조회수·좋아요는 가져오지 않는다(파생 지표 정책 제한).
 * - 후보는 전부 review_state='pending' — 최종 게시 여부는 /admin/sources에서 결정.
 * - search.list는 호출당 100 단위(기본 일일 10,000)라 밈당 1회 검색만 한다.
 *
 * 사용: node scripts/discover-youtube-candidates.mjs [--max=20] [--delay=400] [--dry-run]
 * 필요 환경변수: YOUTUBE_API_KEY (+ Supabase service role)
 */
import { createRestClient, restAll, loadEnv } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

const args = process.argv.slice(2);
const maxArg = args.find((a) => a.startsWith("--max="));
const delayArg = args.find((a) => a.startsWith("--delay="));
const MAX = Math.max(1, Math.min(100, Number(maxArg?.slice(6) ?? 20)));
const DELAY = Math.max(200, Number(delayArg?.slice(8) ?? 400));
const DRY = args.includes("--dry-run");

const env = loadEnv();
const API_KEY = env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY 누락 (.env.local 또는 환경변수)");
  process.exit(1);
}
const rest = createRestClient(env);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function yt(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.search = new URLSearchParams({ ...params, key: API_KEY }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await res.text();
  if (!res.ok) throw new Error(`YouTube ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

function parseDuration(value) {
  const m = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

// 1) 출처가 하나도 없는 밈을 trend_score 순으로 고른다.
const linked = await restAll(rest, "meme_media?select=meme_id");
const hasSource = new Set((linked ?? []).map((row) => row.meme_id));

const memes = [];
for (let offset = 0; memes.length < MAX; offset += 1000) {
  const batch = await rest(
    `memes?select=id,title,slug,aliases,origin_year,korea_viral_year&moderation_status=in.(approved,limited)&order=trend_score.desc&offset=${offset}&limit=1000`
  );
  if (!Array.isArray(batch) || batch.length === 0) break;
  for (const meme of batch) {
    if (!hasSource.has(meme.id)) memes.push(meme);
    if (memes.length >= MAX) break;
  }
  if (batch.length < 1000) break;
}

console.error(`검색 대상 밈 ${memes.length}개 (전체 미연결 ${hasSource.size}개 연결됨)`);

const stats = { searched: 0, candidates: 0, linked: 0, errors: 0 };
const now = new Date().toISOString();
const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();

for (const [index, meme] of memes.entries()) {
  try {
    const query = `"${meme.title}" 원본`;
    const search = await yt("search", {
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "5",
      regionCode: "KR",
      relevanceLanguage: "ko",
      videoEmbeddable: "true",
      safeSearch: "moderate",
    });
    stats.searched += 1;
    const ids = (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);
    if (ids.length === 0) continue;

    const videos = await yt("videos", {
      part: "snippet,status,contentDetails",
      id: ids.join(","),
    });
    const publishable = (videos.items ?? []).filter(
      (v) => v.status?.privacyStatus === "public" && v.status?.embeddable === true
    );

    for (const video of publishable) {
      const normalized = normalizeSourceUrl(
        `https://www.youtube.com/watch?v=${video.id}`
      );
      if (!normalized) continue;
      stats.candidates += 1;
      if (DRY) {
        console.log(
          `[dry-run] ${meme.title} ← ${video.snippet?.title} (${video.snippet?.channelTitle})`
        );
        continue;
      }

      const thumbnails = video.snippet?.thumbnails ?? {};
      const sourceRows = await rest("media_sources?on_conflict=canonical_url", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify({
          platform: normalized.platform,
          external_id: normalized.externalId,
          canonical_url: normalized.canonicalUrl,
          title: video.snippet?.title ?? null,
          channel_name: video.snippet?.channelTitle ?? null,
          channel_id: video.snippet?.channelId ?? null,
          platform_published_at: video.snippet?.publishedAt ?? null,
          duration_seconds: parseDuration(video.contentDetails?.duration),
          public_status: video.status?.privacyStatus ?? "unknown",
          embeddable: true,
          license_code: video.status?.license ?? null,
          made_for_kids: video.status?.madeForKids ?? null,
          thumbnail_url:
            thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
          metadata_refreshed_at: now,
          metadata_expires_at: expires,
          last_checked_at: now,
        }),
      });
      const source = Array.isArray(sourceRows) ? sourceRows[0] : sourceRows;
      if (!source?.id) continue;

      await rest("meme_media", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          meme_id: meme.id,
          source_id: source.id,
          source_role: "usage_example",
          rights_basis: "unknown",
          review_state: "pending",
        }),
      });
      stats.linked += 1;
    }
    console.error(`[${index + 1}/${memes.length}] ${meme.title}: 후보 ${publishable.length}건`);
  } catch (error) {
    stats.errors += 1;
    console.error(
      `[${index + 1}/${memes.length}] ${meme.title} 실패: ${error instanceof Error ? error.message : error}`
    );
  }
  if (index < memes.length - 1) await sleep(DELAY);
}

console.log(JSON.stringify({ dryRun: DRY, ...stats }));
