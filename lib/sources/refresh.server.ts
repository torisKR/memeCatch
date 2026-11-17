import "server-only";

/**
 * 출처 메타데이터 재확인 잡.
 *
 * - YouTube/Shorts: videos.list 배치(50개)로 공개·임베드·라이선스 상태 갱신.
 *   조회되지 않는 ID와 명시적 비공개 영상만 removed_at을 찍는다. 공개지만 임베드가
 *   꺼진 영상은 출처를 보존하고, 임베드 가능 여부만 false로 갱신한다.
 * - TikTok/Instagram: 공개 oEmbed로 생존 여부만 확인한다(스크래핑·다운로드 없음).
 * - 공개 게시물(meme_contents)의 availability를 출처 상태와 동기화한다.
 *   삭제·비공개·지역 제한은 숨기되, 공개 임베드 불가 출처는 링크를 위해 보존한다.
 */

import { getOEmbed, OEmbedError } from "@/lib/oembed";
import { revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";
import { createAdminClient } from "@/lib/db/admin";
import { isYouTubePlatform, type MediaSourcePlatform } from "./url";
import { fetchYouTubeVideoStatuses } from "./youtube.server";
import { isYouTubeRegionBlocked } from "./youtube-region.mjs";
import {
  listDueSourceAcquisitionRecovery,
  listActiveSourceAcquisitionRecovery,
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
  sourceAcquisitionKey,
} from "./recovery.server";

const LIVENESS_INTERVAL_DAYS = 1;
const METADATA_TTL_DAYS = 30;
const YOUTUBE_BATCH_LIMIT = 300;
const SOCIAL_PLATFORM_BATCH_LIMIT = 30;

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
  const { error } = await admin
    .from("meme_contents")
    .update({ availability })
    .eq("platform", DISPLAY_PLATFORM[source.platform])
    .eq("content_id", source.external_id ?? "")
    .eq("type", "embed")
    .neq("availability", availability)
    .select("id");
  if (error) throw new Error("source_content_availability_update_failed");
  // Some legacy entries label Shorts or TikTok URLs as YouTube. Only update
  // those mislabeled rows when both the canonical URL and external ID match.
  if (source.platform !== "youtube" && source.external_id) {
    const { error: legacyError } = await admin
      .from("meme_contents")
      .update({ availability })
      .eq("platform", "YouTube")
      .eq("content_id", source.external_id)
      .eq("url", source.canonical_url)
      .eq("type", "embed")
      .neq("availability", availability)
      .select("id");
    if (legacyError) throw new Error("source_content_availability_update_failed");
  }
}

async function refreshYouTubeSources(
  admin: ReturnType<typeof createAdminClient>,
  rows: MediaSourceRow[],
) {
  // Missing or malformed IDs were never queried from YouTube and cannot be
  // treated as an authoritative missing-video result. Keep healthy sources
  // moving while reporting the bad rows for data repair.
  const validRows = rows.filter((row) => row.external_id && /^[A-Za-z0-9_-]{11}$/.test(row.external_id));
  const validIds = new Set(validRows.map((row) => row.id));
  const invalidRows = rows.filter((row) => !validIds.has(row.id));
  const identityErrors = invalidRows.map((row) => `invalid_source_identity:${row.id}`);
  const invalidCount = identityErrors.length;
  const invalidAttemptAt = new Date();
  for (const row of invalidRows) {
    try {
      // Non-retryable recovery records keep malformed rows out of future
      // refresh budgets while retaining their identity for manual repair.
      await recordSourceAcquisitionFailure({
        sourceKey: `invalid_identity:${row.id}`,
        idempotencyKey: `invalid_identity:${row.id}:${invalidAttemptAt.toISOString()}`,
        platform: row.platform,
        sourceId: row.id,
        externalId: null,
        canonicalUrl: /^https:\/\//i.test(row.canonical_url) ? row.canonical_url : null,
        code: "metadata_mismatch",
        attempt: 1,
        occurredAt: invalidAttemptAt,
      }, admin);
    } catch {
      identityErrors.push(`invalid_identity_quarantine_failed:${row.id}`);
    }
  }
  const ids = validRows.map((row) => row.external_id as string);
  if (ids.length === 0) return { checked: rows.length, removed: 0, hidden: 0, failed: invalidCount, errors: identityErrors };

  const attemptStartedAt = new Date();
  const attemptIdBySource = new Map(rows.map((row) => [row.id, `refresh:${row.id}:${attemptStartedAt.toISOString()}`]));
  let statuses: Awaited<ReturnType<typeof fetchYouTubeVideoStatuses>>;
  try {
    statuses = await fetchYouTubeVideoStatuses(ids);
  } catch (error) {
    for (const row of validRows) {
      if (!row.external_id) continue;
      await recordSourceAcquisitionFailure({
        sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
        idempotencyKey: attemptIdBySource.get(row.id) ?? `refresh:${row.id}:${attemptStartedAt.toISOString()}`,
        platform: row.platform,
        externalId: row.external_id,
        canonicalUrl: row.canonical_url,
        code: "provider_transient",
        attempt: 1,
        occurredAt: attemptStartedAt,
        sourceId: row.id,
      }, admin);
    }
    throw error;
  }
  const now = new Date().toISOString();
  let removed = 0;
  let hidden = 0;
  let failed = invalidCount;
  const errors: string[] = identityErrors;

  for (const row of validRows) {
    const status = row.external_id ? statuses.get(row.external_id) : undefined;

    try {
    if (!status) {
      // 삭제·비공개 전환: 제목·썸네일 캐시를 지우고 게시 임베드를 내린다.
      const { error } = await admin
        .from("media_sources")
        .update({
          removed_at: now,
          last_checked_at: now,
          title: null,
          thumbnail_url: null,
          metadata_expires_at: null,
        })
        .eq("id", row.id);
      if (error) throw new Error("source_refresh_update_failed");
      await syncMemeContentsAvailability(admin, row, "dead");
      if (row.external_id) {
        await resolveSourceAcquisitionFailure({
          sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
          attemptIdempotencyKey: attemptIdBySource.get(row.id) ?? "",
          attemptStartedAt,
          resolvedAt: new Date(now),
        }, admin);
      }
      removed += 1;
      continue;
    }

    if (
      status.privacyStatus === null ||
      (status.privacyStatus === "public" && status.embeddable === null)
    ) {
      throw new Error("source_status_inconclusive");
    }

    const isPublic = status.privacyStatus === "public";
    const isPrivate = status.privacyStatus === "private";
    const embeddable = isPublic && status.embeddable === true;
    const regionBlocked = isYouTubeRegionBlocked({ allowed: status.regionAllowed, blocked: status.regionBlocked });

    const { error } = await admin
      .from("media_sources")
      .update({
        title: isPrivate ? null : status.title,
        channel_name: status.channelTitle,
        channel_id: status.channelId,
        platform_published_at: status.publishedAt,
        duration_seconds: status.durationSeconds,
        public_status: status.privacyStatus,
        removed_at: isPrivate ? now : null,
        embeddable,
        license_code: status.license,
        made_for_kids: status.madeForKids,
        thumbnail_url: isPrivate ? null : status.thumbnailUrl,
        metadata_refreshed_at: now,
        metadata_expires_at: isPrivate ? null : daysFromNow(METADATA_TTL_DAYS),
        last_checked_at: now,
      })
      .eq("id", row.id);
    if (error) throw new Error("source_refresh_update_failed");

    if (isPrivate) {
      await syncMemeContentsAvailability(admin, row, "dead");
      removed += 1;
    } else if (!isPublic) {
      // Unlisted is reachable by URL but is not public catalog content.
      await syncMemeContentsAvailability(admin, row, "dead");
      hidden += 1;
    } else if (regionBlocked) {
      await syncMemeContentsAvailability(admin, row, "region_blocked");
    } else if (!embeddable) {
      // A public video with embedding disabled is still live link-only content.
      // The source update above persists embeddable=false before this projection,
      // so consumers can fail closed instead of rendering an iframe.
      await syncMemeContentsAvailability(admin, row, "live");
      hidden += 1;
    } else {
      await syncMemeContentsAvailability(admin, row, "live");
    }
    if (row.external_id) {
      await resolveSourceAcquisitionFailure({
        sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
        attemptIdempotencyKey: attemptIdBySource.get(row.id) ?? "",
        attemptStartedAt,
        resolvedAt: new Date(now),
      }, admin);
    }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "source_refresh_failed";
      errors.push(message);
      if (!row.external_id) continue;
      try {
        await recordSourceAcquisitionFailure({
          sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
          idempotencyKey: attemptIdBySource.get(row.id) ?? `refresh:${row.id}:${attemptStartedAt.toISOString()}`,
          platform: row.platform,
          externalId: row.external_id,
          canonicalUrl: row.canonical_url,
          code: message === "source_status_inconclusive" ? "provider_transient" : "db_failure",
          attempt: 1,
          occurredAt: attemptStartedAt,
          sourceId: row.id,
        }, admin);
      } catch (recoveryError) {
        errors.push(recoveryError instanceof Error ? recoveryError.message : "source_recovery_record_failed");
      }
    }
  }

  return { checked: rows.length, removed, hidden, failed, errors };
}

async function refreshOEmbedSources(
  admin: ReturnType<typeof createAdminClient>,
  rows: MediaSourceRow[],
) {
  const now = new Date().toISOString();
  let checked = 0;
  let removed = 0;
  let failed = 0;

  for (const row of rows) {
    const attemptStartedAt = new Date();
    const attemptIdempotencyKey = `refresh:${row.id}:${attemptStartedAt.toISOString()}`;
    try {
      const oembed = await getOEmbed(row.canonical_url);
      // TikTok can return a generic player for any ID, including nonexistent
      // videos. A bare player is not evidence that the source is public.
      if (row.platform === "tiktok" && (!oembed.title || !oembed.authorName)) {
        throw new OEmbedError("TikTok source status is inconclusive", "UPSTREAM_ERROR", 502);
      }
      const { error } = await admin
        .from("media_sources")
        .update({
          title: oembed.title,
          channel_name: oembed.authorName,
          embeddable: true,
          removed_at: null,
          last_checked_at: now,
          metadata_refreshed_at: now,
          metadata_expires_at: daysFromNow(METADATA_TTL_DAYS),
        })
        .eq("id", row.id);
      if (error) throw new Error("source_refresh_update_failed");
      await syncMemeContentsAvailability(admin, row, "live");
      if (row.external_id) {
        await resolveSourceAcquisitionFailure({
          sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
          attemptIdempotencyKey,
          attemptStartedAt,
          resolvedAt: new Date(),
        }, admin);
      }
    } catch (error) {
      if (error instanceof OEmbedError && error.status === 404) {
        const { error: sourceError } = await admin
          .from("media_sources")
          .update({
            removed_at: now,
            last_checked_at: now,
            title: null,
            thumbnail_url: null,
            metadata_expires_at: null,
          })
          .eq("id", row.id);
        if (sourceError) throw new Error("source_refresh_update_failed");
        await syncMemeContentsAvailability(admin, row, "dead");
        if (row.external_id) {
          await resolveSourceAcquisitionFailure({
            sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
            attemptIdempotencyKey,
            attemptStartedAt,
            resolvedAt: new Date(),
          }, admin);
        }
        removed += 1;
      } else if (row.external_id) {
        failed += 1;
        await recordSourceAcquisitionFailure({
          sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
          idempotencyKey: attemptIdempotencyKey,
          platform: row.platform,
          externalId: row.external_id,
          canonicalUrl: row.canonical_url,
          code: error instanceof Error && error.message === "source_refresh_update_failed"
            ? "db_failure"
            : "provider_transient",
          attempt: 1,
          occurredAt: attemptStartedAt,
          sourceId: row.id,
        }, admin);
      } else { failed += 1; }
      // 일시 오류(502·네트워크)는 다음 실행으로 미룬다 — last_checked_at을 건드리지 않는다.
    }
    checked += 1;
  }

  return { checked, removed, failed };
}

export type SourceRefreshResult = {
  status: "ok" | "partial" | "failed";
  youtube: { checked: number; removed: number; hidden: number; failed: number; errors: string[] };
  oembed: { checked: number; removed: number; failed: number };
  error?: string;
};

export async function runSourceRefresh(): Promise<SourceRefreshResult> {
  const admin = createAdminClient();
  const dueRecovery = await listDueSourceAcquisitionRecovery(new Date(), 500, admin);
  const activeRecovery = await listActiveSourceAcquisitionRecovery(admin);
  const dueSourceIds = dueRecovery.flatMap((row) => row.sourceId ? [row.sourceId] : []);
  const nowMs = Date.now();
  const deferredSourceIds = activeRecovery.flatMap((row) =>
    row.sourceId && (row.nextRetryAt === null || Date.parse(row.nextRetryAt) > nowMs) ? [row.sourceId] : []);
  const staleBefore = new Date(
    Date.now() - LIVENESS_INTERVAL_DAYS * 86_400_000,
  ).toISOString();

  const staleQueries = await Promise.all([
    { platforms: ["youtube", "youtube_shorts"], limit: YOUTUBE_BATCH_LIMIT },
    { platforms: ["tiktok"], limit: SOCIAL_PLATFORM_BATCH_LIMIT },
    { platforms: ["instagram"], limit: SOCIAL_PLATFORM_BATCH_LIMIT },
  ].map(({ platforms, limit }) => {
    const query = admin.from("media_sources")
      .select("id, platform, external_id, canonical_url, embeddable, removed_at")
      .in("platform", platforms)
      .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    return deferredSourceIds.length ? query.not("id", "in", deferredSourceIds) : query;
  }));
  const selectError = staleQueries.find((result) => result.error)?.error;
  const stale = staleQueries.flatMap((result) => result.data ?? []);

  if (selectError) {
    return {
      status: "failed",
      youtube: { checked: 0, removed: 0, hidden: 0, failed: 0, errors: [] },
      oembed: { checked: 0, removed: 0, failed: 0 },
      error: selectError.message,
    };
  }

  const { data: dueRows, error: dueError } = dueSourceIds.length
    ? await admin
        .from("media_sources")
        .select("id, platform, external_id, canonical_url, embeddable, removed_at")
        .in("id", dueSourceIds)
    : { data: [], error: null };
  if (dueError) {
    return {
      status: "failed",
      youtube: { checked: 0, removed: 0, hidden: 0, failed: 0, errors: [] },
      oembed: { checked: 0, removed: 0, failed: 0 },
      error: dueError.message,
    };
  }
  const recoveryBySourceId = new Map(activeRecovery.flatMap((row) => row.sourceId ? [[row.sourceId, row] as const] : []));
  const candidateRows = [...new Map([...(dueRows ?? []), ...stale].map((row) => [row.id, row])).values()];
  const rows = candidateRows.filter((row) => {
    const recovery = recoveryBySourceId.get(row.id);
    return !recovery || (recovery.nextRetryAt !== null && Date.parse(recovery.nextRetryAt) <= nowMs);
  }) as MediaSourceRow[];
  const youtubeRows = rows
    .filter((row) => isYouTubePlatform(row.platform))
    .slice(0, YOUTUBE_BATCH_LIMIT);
  // An inconclusive provider must not consume another platform's entire
  // daily liveness budget. Each platform gets its own stale and retry slots.
  const oembedRows = (["tiktok", "instagram"] as const).flatMap((platform) =>
    rows.filter((row) => row.platform === platform).slice(0, SOCIAL_PLATFORM_BATCH_LIMIT),
  );

  let youtube = { checked: 0, removed: 0, hidden: 0, failed: 0, errors: [] as string[] };
  let oembed = { checked: 0, removed: 0, failed: 0 };
  let firstError: string | undefined;

  try {
    youtube = await refreshYouTubeSources(admin, youtubeRows);
  } catch (error) {
    firstError = firstError ?? (error instanceof Error ? error.message : String(error));
  }
  try {
    oembed = await refreshOEmbedSources(admin, oembedRows);
  } catch (error) {
    firstError = firstError ?? (error instanceof Error ? error.message : String(error));
  }

  // Next.js queues invalidation for the response lifecycle. Retry on every
  // scheduled run because backend failures can occur after this function returns.
  try {
    revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
  } catch {
    firstError = [firstError, "source_catalog_revalidation_failed"].filter(Boolean).join("; ");
  }

  const result: SourceRefreshResult = {
    status: firstError || youtube.failed > 0 || oembed.failed > 0 || oembed.checked < oembedRows.length ? "partial" : "ok",
    youtube,
    oembed,
    ...(firstError ? { error: firstError } : {}),
  };

  const { error: jobError } = await admin.from("job_runs").insert({
    job_name: "refresh_media_sources",
    finished_at: new Date().toISOString(),
    ok: result.status === "ok",
    detail: result,
  });
  if (jobError) return { ...result, status: "partial", error: jobError.message };

  return result;
}
