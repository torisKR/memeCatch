import "server-only";

/**
 * 출처 메타데이터 재확인 잡.
 *
 * - YouTube/Shorts: videos.list 배치(50개)로 공개·임베드·라이선스 상태 갱신.
 *   조회되지 않는 ID는 삭제로 보고 removed_at을 찍고 제목·썸네일 캐시를 지운다.
 * - TikTok/Instagram: 공개 oEmbed로 생존 여부만 확인한다(스크래핑·다운로드 없음).
 * - 공개 게시물(meme_contents)의 availability를 출처 상태와 동기화한다.
 *   임베드 불가·삭제 출처는 공개 화면에서 자동으로 숨겨진다.
 */

import { getOEmbed, OEmbedError } from "@/lib/oembed";
import { createAdminClient } from "@/lib/supabase/admin";
import { isYouTubePlatform, type MediaSourcePlatform } from "./url";
import { fetchYouTubeVideoStatuses } from "./youtube.server";

const LIVENESS_INTERVAL_DAYS = 7;
const METADATA_TTL_DAYS = 30;
const YOUTUBE_BATCH_LIMIT = 300;
const OEMBED_BATCH_LIMIT = 60;

type MediaSourceRow = {
  id: string;
  platform: MediaSourcePlatform;
  external_id: string | null;
  canonical_url: string;
  embeddable: boolean | null;
  removed_at: string | null;
};

const DISPLAY_PLATFORM: Record<MediaSourcePlatform, string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function syncMemeContentsAvailability(
  admin: ReturnType<typeof createAdminClient>,
  source: MediaSourceRow,
  availability: "live" | "dead" | "region_blocked",
) {
  // 백필이 정규 URL과 content_id를 맞춰두었다는 전제로 둘 다 매칭한다.
  await admin
    .from("meme_contents")
    .update({ availability })
    .eq("platform", DISPLAY_PLATFORM[source.platform])
    .eq("content_id", source.external_id ?? "")
    .eq("type", "embed");
}

async function refreshYouTubeSources(
  admin: ReturnType<typeof createAdminClient>,
  rows: MediaSourceRow[],
) {
  const ids = rows
    .map((row) => row.external_id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return { checked: 0, removed: 0, hidden: 0 };

  const statuses = await fetchYouTubeVideoStatuses(ids);
  const now = new Date().toISOString();
  let removed = 0;
  let hidden = 0;

  for (const row of rows) {
    const status = row.external_id ? statuses.get(row.external_id) : undefined;

    if (!status) {
      // 삭제·비공개 전환: 제목·썸네일 캐시를 지우고 게시 임베드를 내린다.
      await admin
        .from("media_sources")
        .update({
          removed_at: now,
          last_checked_at: now,
          title: null,
          thumbnail_url: null,
          metadata_expires_at: null,
        })
        .eq("id", row.id);
      await syncMemeContentsAvailability(admin, row, "dead");
      removed += 1;
      continue;
    }

    const embeddable = status.privacyStatus === "public" && status.embeddable === true;
    const regionBlocked = status.regionBlocked?.includes("KR") === true;

    await admin
      .from("media_sources")
      .update({
        title: status.title,
        channel_name: status.channelTitle,
        channel_id: status.channelId,
        platform_published_at: status.publishedAt,
        duration_seconds: status.durationSeconds,
        public_status: status.privacyStatus ?? "unknown",
        embeddable,
        license_code: status.license,
        made_for_kids: status.madeForKids,
        thumbnail_url: status.thumbnailUrl,
        metadata_refreshed_at: now,
        metadata_expires_at: daysFromNow(METADATA_TTL_DAYS),
        last_checked_at: now,
      })
      .eq("id", row.id);

    if (!embeddable) {
      await syncMemeContentsAvailability(admin, row, "dead");
      hidden += 1;
    } else if (regionBlocked) {
      await syncMemeContentsAvailability(admin, row, "region_blocked");
    } else {
      await syncMemeContentsAvailability(admin, row, "live");
    }
  }

  return { checked: rows.length, removed, hidden };
}

async function refreshOEmbedSources(
  admin: ReturnType<typeof createAdminClient>,
  rows: MediaSourceRow[],
) {
  const now = new Date().toISOString();
  let checked = 0;
  let removed = 0;

  for (const row of rows) {
    try {
      const oembed = await getOEmbed(row.canonical_url);
      await admin
        .from("media_sources")
        .update({
          title: oembed.title,
          channel_name: oembed.authorName,
          embeddable: true,
          last_checked_at: now,
          metadata_refreshed_at: now,
          metadata_expires_at: daysFromNow(METADATA_TTL_DAYS),
        })
        .eq("id", row.id);
      await syncMemeContentsAvailability(admin, row, "live");
    } catch (error) {
      if (error instanceof OEmbedError && error.status === 404) {
        await admin
          .from("media_sources")
          .update({
            removed_at: now,
            last_checked_at: now,
            title: null,
            thumbnail_url: null,
            metadata_expires_at: null,
          })
          .eq("id", row.id);
        await syncMemeContentsAvailability(admin, row, "dead");
        removed += 1;
      }
      // 일시 오류(502·네트워크)는 다음 실행으로 미룬다 — last_checked_at을 건드리지 않는다.
    }
    checked += 1;
  }

  return { checked, removed };
}

export type SourceRefreshResult = {
  status: "ok" | "partial" | "failed";
  youtube: { checked: number; removed: number; hidden: number };
  oembed: { checked: number; removed: number };
  error?: string;
};

export async function runSourceRefresh(): Promise<SourceRefreshResult> {
  const admin = createAdminClient();
  const staleBefore = new Date(
    Date.now() - LIVENESS_INTERVAL_DAYS * 86_400_000,
  ).toISOString();

  const { data: stale, error: selectError } = await admin
    .from("media_sources")
    .select("id, platform, external_id, canonical_url, embeddable, removed_at")
    .is("removed_at", null)
    .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(YOUTUBE_BATCH_LIMIT + OEMBED_BATCH_LIMIT);

  if (selectError) {
    return {
      status: "failed",
      youtube: { checked: 0, removed: 0, hidden: 0 },
      oembed: { checked: 0, removed: 0 },
      error: selectError.message,
    };
  }

  const rows = (stale ?? []) as MediaSourceRow[];
  const youtubeRows = rows
    .filter((row) => isYouTubePlatform(row.platform))
    .slice(0, YOUTUBE_BATCH_LIMIT);
  const oembedRows = rows
    .filter(
      (row) => row.platform === "tiktok" || row.platform === "instagram",
    )
    .slice(0, OEMBED_BATCH_LIMIT);

  let youtube = { checked: 0, removed: 0, hidden: 0 };
  let oembed = { checked: 0, removed: 0 };
  let firstError: string | undefined;

  try {
    youtube = await refreshYouTubeSources(admin, youtubeRows);
  } catch (error) {
    firstError = error instanceof Error ? error.message : String(error);
  }
  try {
    oembed = await refreshOEmbedSources(admin, oembedRows);
  } catch (error) {
    firstError = firstError ?? (error instanceof Error ? error.message : String(error));
  }

  const result: SourceRefreshResult = {
    status: firstError ? "partial" : "ok",
    youtube,
    oembed,
    ...(firstError ? { error: firstError } : {}),
  };

  await admin.from("job_runs").insert({
    job_name: "refresh_media_sources",
    finished_at: new Date().toISOString(),
    ok: result.status === "ok",
    detail: result,
  });

  return result;
}
