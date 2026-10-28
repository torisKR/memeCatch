import "server-only";

/**
 * 출처 메타데이터 재확인 잡.
 *
 * - YouTube/Shorts: videos.list 배치(50개)로 공개·임베드·라이선스 상태 갱신.
 *   응답에서 빠진 ID는 삭제로 단정하지 않고 검수 가능한 실패로 보존한다.
 * - TikTok/Instagram: 공개 oEmbed로 생존 여부만 확인한다(스크래핑·다운로드 없음).
 * - 공개 게시물(meme_contents)의 availability를 출처 상태와 동기화한다.
 *   임베드 불가·삭제 출처는 공개 화면에서 자동으로 숨겨진다.
 */

import { getOEmbed, OEmbedError } from "@/lib/oembed";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isYouTubePlatform,
  normalizeSourceUrl,
  type MediaSourcePlatform,
} from "./url";
import { fetchYouTubeVideoStatuses } from "./youtube.server";
import {
  listDueSourceAcquisitionRecovery,
  listActiveSourceAcquisitionRecovery,
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
  sourceAcquisitionKey,
} from "./recovery.server";

const LIVENESS_INTERVAL_DAYS = 7;
const METADATA_TTL_DAYS = 30;
const SOURCE_REFRESH_LIMIT = 20;
const YOUTUBE_RUN_LIMIT = 10;
const OEMBED_RUN_LIMIT = 2;
const RUN_BUDGET_MS = 45_000;
const OEMBED_ATTEMPT_TIMEOUT_MS = 4_000;
const MIN_YOUTUBE_START_BUDGET_MS = 20_000;
const MAX_RECOVERY_ATTEMPTS = 3;
const DB_FAILURE_MAX_ATTEMPTS = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DatabaseOperation =
  | "source_metadata_update"
  | "contents_identity_update"
  | "contents_url_update";

class DatabaseOperationError extends Error {
  readonly diagnostic: string;

  constructor(operation: DatabaseOperation, error: unknown) {
    super(operation);
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code).toUpperCase()
      : "";
    this.diagnostic = /^[0-9A-Z]{5}$/.test(code)
      ? `${operation}:${code}`
      : operation;
  }
}

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

function sourceUrlAliases(source: MediaSourceRow, externalId: string) {
  const normalized = normalizeSourceUrl(source.canonical_url);
  const aliases = new Set([source.canonical_url]);
  if (normalized) aliases.add(normalized.canonicalUrl);
  if (isYouTubePlatform(source.platform)) {
    aliases.add(`https://www.youtube.com/watch?v=${externalId}`);
    aliases.add(`https://www.youtube.com/shorts/${externalId}`);
    aliases.add(`https://youtu.be/${externalId}`);
  }
  return [...aliases];
}

async function syncMemeContentsAvailability(
  admin: ReturnType<typeof createAdminClient>,
  source: MediaSourceRow,
  externalId: string,
  availability: "live" | "dead" | "region_blocked",
) {
  const platforms = isYouTubePlatform(source.platform)
    ? [DISPLAY_PLATFORM.youtube, DISPLAY_PLATFORM.youtube_shorts]
    : [DISPLAY_PLATFORM[source.platform]];
  // YouTube와 Shorts는 동일 ID 공간이다. 빈 ID로 넓은 업데이트를 만들지 않는다.
  const idUpdate = await admin
    .from("meme_contents")
    .update({ availability })
    .in("platform", platforms)
    .eq("content_id", externalId)
    .eq("type", "embed");
  if (idUpdate.error) throw new DatabaseOperationError("contents_identity_update", idUpdate.error);

  const urlUpdate = await admin
    .from("meme_contents")
    .update({ availability })
    .in("platform", platforms)
    .in("url", sourceUrlAliases(source, externalId))
    .eq("type", "embed");
  if (urlUpdate.error) throw new DatabaseOperationError("contents_url_update", urlUpdate.error);
}

function sourceExternalId(source: MediaSourceRow): string | null {
  const normalized = normalizeSourceUrl(source.canonical_url);
  if (!normalized) return null;
  const samePlatform = isYouTubePlatform(source.platform)
    ? isYouTubePlatform(normalized.platform)
    : normalized.platform === source.platform;
  if (!samePlatform) return null;

  const stored = source.external_id?.trim() || null;
  if (stored && stored !== normalized.externalId) return null;
  return normalized.externalId;
}

function recoverySourceKey(source: MediaSourceRow, externalId: string | null) {
  return externalId
    ? sourceAcquisitionKey(source.platform, externalId)
    : `${source.platform}:source:${source.id}`;
}

function isRecoveryCircuitOpen(recovery: {
  attemptCount: number;
  lastErrorCode: string;
}) {
  const maxAttempts = recovery.lastErrorCode === "db_failure"
    ? DB_FAILURE_MAX_ATTEMPTS
    : MAX_RECOVERY_ATTEMPTS;
  return recovery.attemptCount >= maxAttempts;
}

function selectRefreshRows(
  recoveryRows: MediaSourceRow[],
  freshRows: MediaSourceRow[],
  limit: number,
) {
  const recoveryReserve = Math.floor(limit / 2);
  const selectedRecovery = recoveryRows.slice(0, recoveryReserve);
  const selectedFresh = freshRows.slice(0, limit - selectedRecovery.length);
  let remaining = limit - selectedRecovery.length - selectedFresh.length;

  if (remaining > 0) {
    selectedRecovery.push(...recoveryRows.slice(selectedRecovery.length, selectedRecovery.length + remaining));
    remaining = limit - selectedRecovery.length - selectedFresh.length;
  }
  if (remaining > 0) {
    selectedFresh.push(...freshRows.slice(selectedFresh.length, selectedFresh.length + remaining));
  }

  return [...selectedRecovery, ...selectedFresh];
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("provider_timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function refreshYouTubeSources(
  admin: ReturnType<typeof createAdminClient>,
  rows: MediaSourceRow[],
  recoverySourceIds: ReadonlySet<string>,
  deadlineAt: number,
) {
  const attemptStartedAt = new Date();
  const attemptIdBySource = new Map(rows.map((row) => [row.id, `refresh:${row.id}:${attemptStartedAt.toISOString()}`]));
  const externalIdBySource = new Map(rows.map((row) => [row.id, sourceExternalId(row)]));
  const ids = [...new Set(externalIdBySource.values())].filter((id): id is string => Boolean(id));
  let removed = 0;
  let hidden = 0;
  let failed = 0;
  let checked = 0;
  let deferred = 0;
  const errors: string[] = [];

  const recordFailure = async (
    row: MediaSourceRow,
    code: "provider_transient" | "provider_uncertain" | "db_failure",
  ) => {
    const externalId = externalIdBySource.get(row.id) ?? null;
    await recordSourceAcquisitionFailure({
      sourceKey: recoverySourceKey(row, externalId),
      idempotencyKey: attemptIdBySource.get(row.id) ?? `refresh:${row.id}:${attemptStartedAt.toISOString()}`,
      platform: row.platform,
      externalId,
      canonicalUrl: row.canonical_url,
      code,
      attempt: 1,
      occurredAt: attemptStartedAt,
      sourceId: row.id,
    }, admin);
  };

  for (const row of rows) {
    if (externalIdBySource.get(row.id)) continue;
    if (Date.now() >= deadlineAt) {
      deferred += 1;
      continue;
    }
    checked += 1;
    failed += 1;
    errors.push("source_identity_uncertain");
    try {
      await recordFailure(row, "provider_uncertain");
    } catch {
      errors.push("source_recovery_record_failed");
    }
  }

  if (ids.length === 0) return { checked, removed, hidden, failed, deferred, errors };

  if (deadlineAt - Date.now() < MIN_YOUTUBE_START_BUDGET_MS) {
    deferred += rows.length - checked - deferred;
    return { checked, removed, hidden, failed, deferred, errors };
  }

  let statuses: Awaited<ReturnType<typeof fetchYouTubeVideoStatuses>>;
  try {
    statuses = await fetchYouTubeVideoStatuses(ids);
  } catch {
    for (const row of rows) {
      if (!externalIdBySource.get(row.id)) continue;
      if (Date.now() >= deadlineAt) {
        deferred += rows.length - checked - deferred;
        break;
      }
      checked += 1;
      failed += 1;
      try {
        await recordFailure(row, "provider_transient");
      } catch {
        errors.push("source_recovery_record_failed");
      }
    }
    errors.push("youtube_provider_transient");
    return { checked, removed, hidden, failed, deferred, errors };
  }
  const now = new Date().toISOString();

  for (const row of rows) {
    const externalId = externalIdBySource.get(row.id);
    if (!externalId) continue;
    if (Date.now() >= deadlineAt) {
      deferred += rows.length - checked - deferred;
      break;
    }
    checked += 1;
    const status = statuses.get(externalId);

    try {
      if (!status) {
        failed += 1;
        errors.push("youtube_status_omitted");
        await recordFailure(row, "provider_uncertain");
        continue;
      }

      const explicitlyDeleted = status.uploadStatus === "deleted";
      const explicitlyUnavailable =
        explicitlyDeleted ||
        status.privacyStatus === "private" ||
        status.privacyStatus === "unlisted" ||
        status.embeddable === false;
      const regionBlocked =
        status.regionBlocked?.includes("KR") === true ||
        (Array.isArray(status.regionAllowed) &&
          status.regionAllowed.length > 0 &&
          !status.regionAllowed.includes("KR"));

      const canRestorePublicPlayback =
        status.privacyStatus === "public" && status.embeddable === true;
      if (!explicitlyUnavailable && !regionBlocked && !canRestorePublicPlayback) {
        failed += 1;
        errors.push("youtube_status_uncertain");
        await recordFailure(row, "provider_uncertain");
        continue;
      }

      if (explicitlyDeleted) {
        const { error } = await admin
          .from("media_sources")
          .update({
            removed_at: now,
            last_checked_at: now,
            title: null,
            channel_name: null,
            channel_id: null,
            platform_published_at: null,
            duration_seconds: null,
            public_status: "unknown",
            embeddable: false,
            license_code: null,
            made_for_kids: null,
            thumbnail_url: null,
            metadata_refreshed_at: null,
            metadata_expires_at: null,
          })
          .eq("id", row.id);
        if (error) throw new DatabaseOperationError("source_metadata_update", error);
        await syncMemeContentsAvailability(admin, row, externalId, "dead");
        removed += 1;
      } else {
        const { error } = await admin
          .from("media_sources")
          .update({
            title: status.title,
            channel_name: status.channelTitle,
            channel_id: status.channelId,
            platform_published_at: status.publishedAt,
            duration_seconds: status.durationSeconds,
            public_status: status.privacyStatus ?? "unknown",
            embeddable: explicitlyUnavailable || regionBlocked ? false : true,
            license_code: status.license,
            made_for_kids: status.madeForKids,
            thumbnail_url: status.thumbnailUrl,
            metadata_refreshed_at: now,
            metadata_expires_at: daysFromNow(METADATA_TTL_DAYS),
            last_checked_at: now,
          })
          .eq("id", row.id);
        if (error) throw new DatabaseOperationError("source_metadata_update", error);

        if (explicitlyUnavailable) {
          await syncMemeContentsAvailability(admin, row, externalId, "dead");
          hidden += 1;
        } else if (regionBlocked) {
          await syncMemeContentsAvailability(admin, row, externalId, "region_blocked");
          hidden += 1;
        } else {
          await syncMemeContentsAvailability(admin, row, externalId, "live");
        }
      }
      if (recoverySourceIds.has(row.id)) {
        await resolveSourceAcquisitionFailure({
          sourceKey: recoverySourceKey(row, externalId),
          attemptIdempotencyKey: attemptIdBySource.get(row.id) ?? "",
          attemptStartedAt,
          resolvedAt: new Date(now),
        }, admin);
      }
    } catch (error) {
      failed += 1;
      errors.push(error instanceof DatabaseOperationError ? error.diagnostic : "source_refresh_failed");
      try {
        await recordFailure(row, "db_failure");
      } catch {
        errors.push("source_recovery_record_failed");
      }
    }
  }

  return { checked, removed, hidden, failed, deferred, errors };
}

async function refreshOEmbedSources(
  admin: ReturnType<typeof createAdminClient>,
  rows: MediaSourceRow[],
  recoverySourceIds: ReadonlySet<string>,
  deadlineAt: number,
) {
  const now = new Date().toISOString();
  let checked = 0;
  const removed = 0;
  let hidden = 0;
  let failed = 0;
  let deferred = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      deferred += rows.length - checked;
      break;
    }
    const attemptStartedAt = new Date();
    const attemptIdempotencyKey = `refresh:${row.id}:${attemptStartedAt.toISOString()}`;
    const externalId = sourceExternalId(row);
    checked += 1;
    if (!externalId) {
      failed += 1;
      errors.push("source_identity_uncertain");
      try {
        await recordSourceAcquisitionFailure({
          sourceKey: recoverySourceKey(row, null),
          idempotencyKey: attemptIdempotencyKey,
          platform: row.platform,
          externalId: null,
          canonicalUrl: row.canonical_url,
          code: "provider_uncertain",
          attempt: 1,
          occurredAt: attemptStartedAt,
          sourceId: row.id,
        }, admin);
      } catch {
        errors.push("source_recovery_record_failed");
      }
      continue;
    }
    try {
      const oembed = await withTimeout(
        getOEmbed(row.canonical_url),
        Math.min(OEMBED_ATTEMPT_TIMEOUT_MS, remainingMs),
      );
      const { error } = await admin
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
      if (error) throw new DatabaseOperationError("source_metadata_update", error);
      await syncMemeContentsAvailability(admin, row, externalId, "live");
      if (recoverySourceIds.has(row.id)) {
        await resolveSourceAcquisitionFailure({
          sourceKey: recoverySourceKey(row, externalId),
          attemptIdempotencyKey,
          attemptStartedAt,
          resolvedAt: new Date(now),
        }, admin);
      }
    } catch (error) {
      if (error instanceof OEmbedError && error.status === 404) {
        try {
          const { error: sourceError } = await admin
            .from("media_sources")
            .update({
              embeddable: false,
              last_checked_at: now,
              title: null,
              channel_name: null,
              channel_id: null,
              platform_published_at: null,
              duration_seconds: null,
              license_code: null,
              made_for_kids: null,
              thumbnail_url: null,
              metadata_refreshed_at: null,
              metadata_expires_at: null,
            })
            .eq("id", row.id);
          if (sourceError) throw new DatabaseOperationError("source_metadata_update", sourceError);
          await syncMemeContentsAvailability(admin, row, externalId, "dead");
          if (recoverySourceIds.has(row.id)) {
            await resolveSourceAcquisitionFailure({
              sourceKey: recoverySourceKey(row, externalId),
              attemptIdempotencyKey,
              attemptStartedAt,
              resolvedAt: new Date(now),
            }, admin);
          }
          hidden += 1;
        } catch (updateError) {
          failed += 1;
          errors.push(updateError instanceof DatabaseOperationError
            ? updateError.diagnostic
            : "source_refresh_failed");
          try {
            await recordSourceAcquisitionFailure({
              sourceKey: recoverySourceKey(row, externalId),
              idempotencyKey: attemptIdempotencyKey,
              platform: row.platform,
              externalId,
              canonicalUrl: row.canonical_url,
              code: "db_failure",
              attempt: 1,
              occurredAt: attemptStartedAt,
              sourceId: row.id,
            }, admin);
          } catch {
            errors.push("source_recovery_record_failed");
          }
        }
      } else {
        failed += 1;
        const databaseFailure = error instanceof DatabaseOperationError;
        errors.push(databaseFailure ? error.diagnostic : "oembed_provider_transient");
        try {
          await recordSourceAcquisitionFailure({
            sourceKey: recoverySourceKey(row, externalId),
            idempotencyKey: attemptIdempotencyKey,
            platform: row.platform,
            externalId,
            canonicalUrl: row.canonical_url,
            code: databaseFailure ? "db_failure" : "provider_transient",
            attempt: 1,
            occurredAt: attemptStartedAt,
            sourceId: row.id,
          }, admin);
        } catch {
          errors.push("source_recovery_record_failed");
        }
      }
      // 일시 오류(502·네트워크)는 다음 실행으로 미룬다 — last_checked_at을 건드리지 않는다.
    }
  }

  return { checked, removed, hidden, failed, deferred, errors };
}

export type SourceRefreshResult = {
  status: "ok" | "partial" | "failed";
  circuitOpen: number;
  youtube: { checked: number; removed: number; hidden: number; failed: number; deferred: number; errors: string[] };
  oembed: { checked: number; removed: number; hidden: number; failed: number; deferred: number; errors: string[] };
  error?: string;
};

type SourceRefreshCandidateRpcResult = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

type SourceRefreshCandidateRpc = {
  rpc(
    name: "list_source_refresh_candidates",
    args: {
      p_stale_before: string;
      p_platforms: readonly MediaSourcePlatform[];
      p_limit: number;
    },
  ): SourceRefreshCandidateRpcResult;
};

function listSourceRefreshCandidates(
  admin: ReturnType<typeof createAdminClient>,
  staleBefore: string,
  platforms: readonly MediaSourcePlatform[],
  limit: number,
) {
  return (admin as unknown as SourceRefreshCandidateRpc).rpc(
    "list_source_refresh_candidates",
    {
      p_stale_before: staleBefore,
      p_platforms: platforms,
      p_limit: limit,
    },
  );
}

export async function runSourceRefresh(options: { sourceId?: string } = {}): Promise<SourceRefreshResult> {
  const sourceId = options.sourceId;
  if (sourceId !== undefined && !UUID_PATTERN.test(sourceId)) {
    throw new Error("source_refresh_invalid_source_id");
  }
  const deadlineAt = Date.now() + RUN_BUDGET_MS;
  const admin = createAdminClient();
  const refreshStartedAt = new Date();
  const allActiveRecovery = await listActiveSourceAcquisitionRecovery(admin, sourceId);
  const activeRecovery = sourceId
    ? allActiveRecovery.filter((row) => row.sourceId === sourceId)
    : allActiveRecovery;
  const dueRecovery = sourceId
    ? activeRecovery.filter((row) => (
        row.nextRetryAt !== null &&
        Date.parse(row.nextRetryAt) <= refreshStartedAt.getTime()
      ))
    : await listDueSourceAcquisitionRecovery(refreshStartedAt, SOURCE_REFRESH_LIMIT, admin);
  const circuitOpenRecovery = dueRecovery.filter(isRecoveryCircuitOpen);
  const dueSourceIds = dueRecovery
    .filter((row) => !isRecoveryCircuitOpen(row))
    .flatMap((row) => row.sourceId ? [row.sourceId] : []);
  const circuitOpen = circuitOpenRecovery.length;
  const staleBefore = new Date(
    Date.now() - LIVENESS_INTERVAL_DAYS * 86_400_000,
  ).toISOString();

  let staleYouTube: unknown[] | null = [];
  let staleOEmbed: unknown[] | null = [];
  let youtubeSelectError: { message: string } | null = null;
  let oembedSelectError: { message: string } | null = null;

  if (sourceId) {
    const { data, error } = await admin
      .from("media_sources")
      .select("id, platform, external_id, canonical_url, embeddable, removed_at")
      .eq("id", sourceId)
      .limit(1);
    const scopedRows = ((data ?? []) as MediaSourceRow[]).filter(
      (row) => row.id === sourceId && row.removed_at === null,
    );
    staleYouTube = scopedRows.filter((row) => isYouTubePlatform(row.platform));
    staleOEmbed = scopedRows.filter((row) => row.platform === "tiktok" || row.platform === "instagram");
    youtubeSelectError = error;
  } else {
    const youtubeSelection = await listSourceRefreshCandidates(
      admin,
      staleBefore,
      ["youtube", "youtube_shorts"],
      YOUTUBE_RUN_LIMIT,
    );
    staleYouTube = youtubeSelection.data;
    youtubeSelectError = youtubeSelection.error;

    const oembedSelection = await listSourceRefreshCandidates(
      admin,
      staleBefore,
      ["tiktok", "instagram"],
      OEMBED_RUN_LIMIT,
    );
    staleOEmbed = oembedSelection.data;
    oembedSelectError = oembedSelection.error;
  }

  const selectError = youtubeSelectError ?? oembedSelectError;
  if (selectError) {
    return {
      status: "failed",
      circuitOpen,
      youtube: { checked: 0, removed: 0, hidden: 0, failed: 0, deferred: 0, errors: [] },
      oembed: { checked: 0, removed: 0, hidden: 0, failed: 0, deferred: 0, errors: [] },
      error: selectError.message,
    };
  }

  const scopedRows = [...((staleYouTube ?? []) as MediaSourceRow[]), ...((staleOEmbed ?? []) as MediaSourceRow[])];
  const { data: dueRows, error: dueError } = sourceId
    ? { data: scopedRows.filter((row) => dueSourceIds.includes(row.id)), error: null }
    : dueSourceIds.length
    ? await admin
        .from("media_sources")
        .select("id, platform, external_id, canonical_url, embeddable, removed_at")
        .in("id", dueSourceIds)
    : { data: [], error: null };
  if (dueError) {
    return {
      status: "failed",
      circuitOpen,
      youtube: { checked: 0, removed: 0, hidden: 0, failed: 0, deferred: 0, errors: [] },
      oembed: { checked: 0, removed: 0, hidden: 0, failed: 0, deferred: 0, errors: [] },
      error: dueError.message,
    };
  }
  const recoveryBySourceId = new Map(activeRecovery.flatMap((row) => row.sourceId ? [[row.sourceId, row] as const] : []));
  const recoverySourceIds = new Set([
    ...recoveryBySourceId.keys(),
    ...dueSourceIds,
  ]);
  const dueRowById = new Map((dueRows ?? []).map((row) => [row.id, row as MediaSourceRow]));
  const recoveryRows = dueSourceIds.flatMap((id) => {
    const row = dueRowById.get(id);
    return row ? [row] : [];
  });
  const freshYouTubeRows = ((staleYouTube ?? []) as MediaSourceRow[]).filter(
    (row) => isYouTubePlatform(row.platform) && !recoveryBySourceId.has(row.id),
  );
  const freshOEmbedRows = ((staleOEmbed ?? []) as MediaSourceRow[]).filter(
    (row) => (row.platform === "tiktok" || row.platform === "instagram") && !recoveryBySourceId.has(row.id),
  );
  const youtubeRows = selectRefreshRows(
    recoveryRows.filter((row) => isYouTubePlatform(row.platform)),
    freshYouTubeRows,
    YOUTUBE_RUN_LIMIT,
  );
  const oembedRows = selectRefreshRows(
    recoveryRows.filter((row) => row.platform === "tiktok" || row.platform === "instagram"),
    freshOEmbedRows,
    OEMBED_RUN_LIMIT,
  );

  let youtube = { checked: 0, removed: 0, hidden: 0, failed: 0, deferred: 0, errors: [] as string[] };
  let oembed = { checked: 0, removed: 0, hidden: 0, failed: 0, deferred: 0, errors: [] as string[] };
  let firstError: string | undefined;

  try {
    youtube = await refreshYouTubeSources(admin, youtubeRows, recoverySourceIds, deadlineAt);
  } catch (error) {
    firstError = error instanceof Error ? error.message : String(error);
  }
  try {
    oembed = await refreshOEmbedSources(admin, oembedRows, recoverySourceIds, deadlineAt);
  } catch (error) {
    firstError = firstError ?? (error instanceof Error ? error.message : String(error));
  }

  const result: SourceRefreshResult = {
    status: firstError || circuitOpen > 0 || youtube.failed > 0 || oembed.failed > 0 || youtube.deferred > 0 || oembed.deferred > 0 ? "partial" : "ok",
    circuitOpen,
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
