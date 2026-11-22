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
import { isYouTubePlatform, normalizeSourceUrl, type MediaSourcePlatform } from "./url";
import { fetchYouTubeVideoStatuses } from "./youtube.server";
import { isYouTubeRegionBlocked } from "./youtube-region.mjs";
import {
  listDueSourceAcquisitionRecovery,
  listActiveSourceAcquisitionRecovery,
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
  sourceAcquisitionKey,
  type SourceAcquisitionRecoveryDto,
} from "./recovery.server";

const LIVENESS_INTERVAL_DAYS = 1;
const METADATA_TTL_DAYS = 30;
const YOUTUBE_BATCH_LIMIT = 300;
const SOCIAL_PLATFORM_BATCH_LIMIT = 30;
/** Extra stale rows read per group in case the in-memory identity check drops some. */
const STALE_CONFLICT_HEADROOM = 50;
/** Upper bound for each candidate lookup, so one slow query cannot stall the run. */
const SOURCE_LOOKUP_TIMEOUT_MS = 10_000;
/**
 * Time from job start after which a provider worker starts no new source.
 * The cron route allows 60 s and an oEmbed request can take 8 s, so this
 * leaves room for in-flight requests and the job audit insert. Unstarted rows
 * keep their last_checked_at and are picked up by the next run.
 */
export const SOURCE_REFRESH_PROVIDER_BUDGET_MS = 40_000;

type MediaSourceRow = {
  id: string;
  platform: MediaSourcePlatform;
  external_id: string | null;
  canonical_url: string;
  embeddable: boolean | null;
  removed_at: string | null;
};

type PlatformObservation = {
  selected: number;
  provider_submitted: number;
  confirmed: number;
  inconclusive: number;
  invalid_identity: number;
};

type RefreshObservations = Record<MediaSourcePlatform, PlatformObservation>;

function emptyObservations(): RefreshObservations {
  const empty = (): PlatformObservation => ({ selected: 0, provider_submitted: 0, confirmed: 0, inconclusive: 0, invalid_identity: 0 });
  return { youtube: empty(), youtube_shorts: empty(), instagram: empty(), tiktok: empty() };
}

const DISPLAY_PLATFORM: Record<MediaSourcePlatform, string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function normalizedSourceIdentity(row: MediaSourceRow) {
  if (!row.external_id) return null;
  const normalized = normalizeSourceUrl(row.canonical_url);
  if (
    !normalized ||
    normalized.externalId !== row.external_id ||
    normalized.canonicalUrl !== row.canonical_url
  ) return null;
  if (isYouTubePlatform(row.platform)) {
    return isYouTubePlatform(normalized.platform) ? normalized : null;
  }
  return normalized.platform === row.platform ? normalized : null;
}

async function quarantineInvalidIdentity(
  admin: ReturnType<typeof createAdminClient>,
  row: MediaSourceRow,
  attemptedAt: Date,
) {
  await recordSourceAcquisitionFailure({
    sourceKey: `invalid_identity:${row.id}`,
    idempotencyKey: `invalid_identity:${row.id}:${attemptedAt.toISOString()}`,
    platform: row.platform,
    sourceId: row.id,
    externalId: null,
    canonicalUrl: /^https:\/\//i.test(row.canonical_url) ? row.canonical_url : null,
    code: "metadata_mismatch",
    attempt: 1,
    occurredAt: attemptedAt,
  }, admin);
}

function providerIdentityRecoveryKey(row: MediaSourceRow) {
  return `provider_identity:${row.id}`;
}

function recoveryMatchesSource(recovery: SourceAcquisitionRecoveryDto, source: MediaSourceRow) {
  if (recovery.sourceId !== source.id || recovery.platform !== source.platform || !source.external_id) return false;
  if (recovery.sourceKey === sourceAcquisitionKey(source.platform, source.external_id)) {
    return recovery.externalId === null || recovery.externalId === source.external_id;
  }
  return source.platform === "tiktok" && recovery.sourceKey === providerIdentityRecoveryKey(source)
    && recovery.externalId === source.external_id;
}

/**
 * Builds an `or` filter that keeps stale-source selection away from unowned
 * platform-and-ID recovery keys: keys with no source id, or whose recorded
 * external id differs from the key. Every source with such an ID would fail
 * the identity check, and since it is never refreshed it would keep the oldest
 * positions forever.
 *
 * The filter is flat (`external_id.is.null,external_id.not.in.(...)`) because
 * the database plan client (`lib/db/plan.ts`) parses only flat `or` groups and
 * splits `in` lists on commas. Rows without an external id always pass, so
 * invalid identities still reach quarantine. IDs containing list syntax are
 * left to the in-memory check. Owned keys are not filtered here: a second
 * source sharing an owned ID is a duplicate row, and the in-memory check plus
 * the headroom rows handle it. The filter is per external id, so within the
 * YouTube group a Shorts row sharing an ID with an unowned YouTube key is also
 * held back.
 */
export function staleRecoveryExclusion(
  activeRecovery: SourceAcquisitionRecoveryDto[],
  platforms: readonly MediaSourcePlatform[],
): { filter: string | null; unownedKeys: number } {
  const unowned = new Set<string>();
  for (const recovery of activeRecovery) {
    if (!platforms.includes(recovery.platform as MediaSourcePlatform)) continue;
    const prefix = `${recovery.platform}:`;
    if (!recovery.sourceKey.startsWith(prefix)) continue;
    const externalId = recovery.sourceKey.slice(prefix.length);
    if (!externalId) continue;
    if (!recovery.sourceId || (recovery.externalId !== null && recovery.externalId !== externalId)) unowned.add(externalId);
  }
  const listed = [...unowned].filter((externalId) => !/[,()"\\]/.test(externalId));
  return {
    filter: listed.length > 0 ? `external_id.is.null,external_id.not.in.(${listed.join(",")})` : null,
    unownedKeys: unowned.size,
  };
}

function canChangeRecoveryKey(activeRecovery: SourceAcquisitionRecoveryDto[], source: MediaSourceRow, key: string) {
  const recovery = activeRecovery.find((entry) => entry.sourceKey === key);
  return !recovery || recoveryMatchesSource(recovery, source);
}

function tiktokProviderIdentityState(
  row: MediaSourceRow,
  oembed: Awaited<ReturnType<typeof getOEmbed>>,
) {
  // TikTok embeds can expose a provider-owned video ID in returned HTML.
  // Instagram oEmbed has no equivalent independently trustworthy ID, so its
  // response cannot strengthen the pre-request canonical identity check.
  if (row.platform !== "tiktok") return "not_applicable" as const;
  if (oembed.providerContentId === null) return "inconclusive" as const;
  return oembed.providerContentId === row.external_id ? "confirmed" as const : "mismatch" as const;
}

async function recordProviderIdentityFailure(
  admin: ReturnType<typeof createAdminClient>,
  row: MediaSourceRow,
  attemptedAt: Date,
  preserveExistingProviderKey: boolean,
  activeRecovery: SourceAcquisitionRecoveryDto[],
) {
  const sourceKey = preserveExistingProviderKey && row.external_id
    ? sourceAcquisitionKey(row.platform, row.external_id)
    : providerIdentityRecoveryKey(row);
  if (!canChangeRecoveryKey(activeRecovery, row, sourceKey)) throw new Error("source_recovery_identity_mismatch");
  await recordSourceAcquisitionFailure({
    sourceKey,
    idempotencyKey: `${sourceKey}:${attemptedAt.toISOString()}`,
    platform: row.platform,
    sourceId: row.id,
    externalId: row.external_id,
    canonicalUrl: row.canonical_url,
    code: "provider_transient",
    attempt: 1,
    occurredAt: attemptedAt,
  }, admin);
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
  observations: RefreshObservations,
  activeRecovery: SourceAcquisitionRecoveryDto[],
) {
  // Missing or malformed IDs were never queried from YouTube and cannot be
  // treated as an authoritative missing-video result. Keep healthy sources
  // moving while reporting the bad rows for data repair.
  const validRows = rows.filter((row) => normalizedSourceIdentity(row));
  const validIds = new Set(validRows.map((row) => row.id));
  const invalidRows = rows.filter((row) => !validIds.has(row.id));
  for (const row of invalidRows) observations[row.platform].invalid_identity += 1;
  const identityErrors = invalidRows.map((row) => `invalid_source_identity:${row.id}`);
  const invalidCount = identityErrors.length;
  const invalidAttemptAt = new Date();
  for (const row of invalidRows) {
    try {
      // Non-retryable recovery records keep malformed rows out of future
      // refresh budgets while retaining their identity for manual repair.
      await quarantineInvalidIdentity(admin, row, invalidAttemptAt);
    } catch {
      identityErrors.push(`invalid_identity_quarantine_failed:${row.id}`);
    }
  }
  const ids = validRows.map((row) => row.external_id as string);
  if (ids.length === 0) return { checked: rows.length, removed: 0, hidden: 0, failed: invalidCount, errors: identityErrors };

  const attemptStartedAt = new Date();
  const attemptIdBySource = new Map(rows.map((row) => [row.id, `refresh:${row.id}:${attemptStartedAt.toISOString()}`]));
  let statuses: Awaited<ReturnType<typeof fetchYouTubeVideoStatuses>>;
  for (const row of validRows) observations[row.platform].provider_submitted += 1;
  try {
    statuses = await fetchYouTubeVideoStatuses(ids);
  } catch (error) {
    for (const row of validRows) observations[row.platform].inconclusive += 1;
    for (const row of validRows) {
      if (!row.external_id) continue;
      if (!canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) continue;
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
    const inconclusive = status && (
      status.privacyStatus === null ||
      (status.privacyStatus === "public" && status.embeddable === null)
    );
    observations[row.platform][inconclusive ? "inconclusive" : "confirmed"] += 1;

    try {
    if (!status) {
      // 삭제·비공개 전환: 제목·썸네일 캐시를 지우고 게시 임베드를 내린다.
      await syncMemeContentsAvailability(admin, row, "dead");
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
      if (row.external_id && canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
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
    const availability = !isPublic ? "dead" : regionBlocked ? "region_blocked" : "live";

    // Hide content before persisting a negative source status. On restoration,
    // persist the source first so a failed write cannot prematurely expose it.
    if (availability !== "live") await syncMemeContentsAvailability(admin, row, availability);

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
    if (availability === "live") await syncMemeContentsAvailability(admin, row, availability);

    if (isPrivate) {
      removed += 1;
    } else if (!isPublic) {
      // Unlisted is reachable by URL but is not public catalog content.
      hidden += 1;
    } else if (!regionBlocked && !embeddable) {
      // A public video with embedding disabled is still live link-only content.
      // The source update above persists embeddable=false before this projection,
      // so consumers can fail closed instead of rendering an iframe.
      hidden += 1;
    }
    if (row.external_id && canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
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
      if (!canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
        errors.push(`source_recovery_identity_mismatch:${row.id}`);
        continue;
      }
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
  observations: RefreshObservations,
  activeRecovery: SourceAcquisitionRecoveryDto[],
  deadlineMs: number = Number.POSITIVE_INFINITY,
) {
  const now = new Date().toISOString();
  let checked = 0;
  let removed = 0;
  let failed = 0;
  const errors: string[] = [];

  let deferredByDeadline = 0;
  for (const row of rows) {
    if (Date.now() >= deadlineMs) {
      // Leave the rest untouched (no ledger write, no last_checked_at change).
      deferredByDeadline = rows.length - rows.indexOf(row);
      break;
    }
    const attemptStartedAt = new Date();
    const attemptIdempotencyKey = `refresh:${row.id}:${attemptStartedAt.toISOString()}`;
    const providerRecovery = activeRecovery.find((recovery) => recovery.sourceKey === providerIdentityRecoveryKey(row));
    const mayResolveProviderRecovery = !!providerRecovery && recoveryMatchesSource(providerRecovery, row);
    if (!normalizedSourceIdentity(row)) {
      observations[row.platform].invalid_identity += 1;
      failed += 1;
      checked += 1;
      try {
        await quarantineInvalidIdentity(admin, row, attemptStartedAt);
      } catch {
        errors.push(`invalid_identity_quarantine_failed:${row.id}`);
      }
      continue;
    }
    let providerClassified = false;
    try {
      observations[row.platform].provider_submitted += 1;
      const oembed = await getOEmbed(row.canonical_url);
      const providerIdentity = tiktokProviderIdentityState(row, oembed);
      if (providerIdentity === "mismatch" || providerIdentity === "inconclusive") {
        observations[row.platform].inconclusive += 1;
        failed += 1;
        checked += 1;
        try {
          await recordProviderIdentityFailure(admin, row, attemptStartedAt, !!providerRecovery && !mayResolveProviderRecovery, activeRecovery);
        } catch {
          errors.push(`provider_identity_recovery_failed:${row.id}`);
        }
        continue;
      }
      // TikTok can return a generic player for any ID, including nonexistent
      // videos. A bare player is not evidence that the source is public.
      if (row.platform === "tiktok" && (!oembed.title || !oembed.authorName)) {
        throw new OEmbedError("TikTok source status is inconclusive", "UPSTREAM_ERROR", 502);
      }
      observations[row.platform].confirmed += 1;
      providerClassified = true;
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
        try {
          if (providerIdentity === "confirmed" && mayResolveProviderRecovery) {
            await resolveSourceAcquisitionFailure({
              sourceKey: providerIdentityRecoveryKey(row),
              attemptIdempotencyKey: `${attemptIdempotencyKey}:provider_identity`,
              attemptStartedAt,
              resolvedAt: new Date(),
            }, admin);
          }
          if (canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
            await resolveSourceAcquisitionFailure({
              sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
              attemptIdempotencyKey,
              attemptStartedAt,
              resolvedAt: new Date(),
            }, admin);
          }
        } catch {
          // Source and content are already live. A recovery-ledger failure is
          // not provider evidence and must not rewrite or reclassify this row.
          failed += 1;
          checked += 1;
          errors.push(`social_live_recovery_resolve_failed:${row.id}`);
          continue;
        }
      }
    } catch (error) {
      if (error instanceof OEmbedError && error.status === 404) {
        if (!providerClassified) observations[row.platform].confirmed += 1;
        try {
          // Project dead content first so a failed source write remains due and
          // cannot leave live content behind a freshly checked removed source.
          await syncMemeContentsAvailability(admin, row, "dead");
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
        } catch {
          failed += 1;
          checked += 1;
          errors.push(`social_404_write_failed:${row.id}`);
          if (row.external_id && canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
            try {
              await recordSourceAcquisitionFailure({
                sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
                idempotencyKey: attemptIdempotencyKey,
                platform: row.platform,
                externalId: row.external_id,
                canonicalUrl: row.canonical_url,
                code: "db_failure",
                attempt: 1,
                occurredAt: attemptStartedAt,
                sourceId: row.id,
              }, admin);
            } catch {
              errors.push(`source_recovery_record_failed:${row.id}`);
            }
          }
          continue;
        }
        if (row.external_id) {
          try {
            if (row.platform === "tiktok" && mayResolveProviderRecovery) {
              await resolveSourceAcquisitionFailure({
                sourceKey: providerIdentityRecoveryKey(row),
                attemptIdempotencyKey: `${attemptIdempotencyKey}:provider_identity`,
                attemptStartedAt,
                resolvedAt: new Date(),
              }, admin);
            }
            if (canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
              await resolveSourceAcquisitionFailure({
                sourceKey: sourceAcquisitionKey(row.platform, row.external_id),
                attemptIdempotencyKey,
                attemptStartedAt,
                resolvedAt: new Date(),
              }, admin);
            }
          } catch {
            failed += 1;
            checked += 1;
            errors.push(`social_404_recovery_resolve_failed:${row.id}`);
            continue;
          }
        }
        removed += 1;
      } else if (row.external_id) {
        if (!providerClassified) observations[row.platform].inconclusive += 1;
        failed += 1;
        if (!canChangeRecoveryKey(activeRecovery, row, sourceAcquisitionKey(row.platform, row.external_id))) {
          errors.push(`source_recovery_identity_mismatch:${row.id}`);
          checked += 1;
          continue;
        }
        try {
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
        } catch {
          errors.push(`source_recovery_record_failed:${row.id}`);
        }
      } else { failed += 1; }
      // 일시 오류(502·네트워크)는 다음 실행으로 미룬다 — last_checked_at을 건드리지 않는다.
    }
    checked += 1;
  }

  return { checked, removed, failed, errors, deferred_by_deadline: deferredByDeadline };
}

export type SourceRefreshResult = {
  status: "ok" | "partial" | "failed";
  youtube: { checked: number; removed: number; hidden: number; failed: number; errors: string[] };
  oembed: { checked: number; removed: number; failed: number; errors: string[]; deferred_by_deadline: number };
  observations: RefreshObservations;
  recovery_unmatched_due_keys: number;
  recovery_conflicting_stale_sources: number;
  recovery_unowned_keys: number;
  error?: string;
};

export async function runSourceRefresh(): Promise<SourceRefreshResult> {
  const startedAt = new Date().toISOString();
  const providerDeadlineMs = Date.parse(startedAt) + SOURCE_REFRESH_PROVIDER_BUDGET_MS;
  const observations = emptyObservations();
  let unmatchedDueKeys = 0;
  const conflictingStaleIds = new Set<string>();
  const admin = createAdminClient();
  const dueRecovery = await listDueSourceAcquisitionRecovery(new Date(), 500, admin);
  let activeRecovery = await listActiveSourceAcquisitionRecovery(admin);
  const identityQuarantines = activeRecovery.filter((row) =>
    row.sourceId && row.sourceKey === `invalid_identity:${row.sourceId}` && row.lastErrorCode === "metadata_mismatch",
  );
  if (identityQuarantines.length > 0) {
    // A repaired ID and canonical URL only release the quarantine; the source
    // is still checked with its provider before any availability is changed.
    const repairAttempt = new Date();
    for (let offset = 0; offset < identityQuarantines.length; offset += 500) {
      const batch = identityQuarantines.slice(offset, offset + 500);
      const { data, error } = await admin.from("media_sources")
        .select("id, platform, external_id, canonical_url")
        .in("id", batch.map((row) => row.sourceId));
      if (error) throw new Error("source_identity_repair_lookup_failed");
      const byId = new Map((data ?? []).map((row) => [row.id, row]));
      for (const recovery of batch) {
        if (!recovery.sourceId) continue;
        const source = byId.get(recovery.sourceId);
        if (!source || !source.external_id) continue;
        if (!normalizedSourceIdentity(source as MediaSourceRow)) continue;
        await resolveSourceAcquisitionFailure({
          sourceKey: recovery.sourceKey,
          attemptIdempotencyKey: `identity-repair:${source.id}:${repairAttempt.toISOString()}`,
          attemptStartedAt: repairAttempt,
          resolvedAt: new Date(),
        }, admin);
      }
    }
    // Resolution can lose a race with a newer failure; re-read authoritative
    // recovery state rather than assuming every request resolved its key.
    activeRecovery = await listActiveSourceAcquisitionRecovery(admin);
  }
  const nowMs = Date.now();
  const deferredSourceIds = activeRecovery.flatMap((row) =>
    row.sourceId && (row.nextRetryAt === null || Date.parse(row.nextRetryAt) > nowMs) ? [row.sourceId] : []);
  const deferredIds = new Set(deferredSourceIds);
  // The due RPC is globally capped at 500. The active snapshot is already
  // needed for backoff and quarantine; use it to give every platform a bounded
  // share even if another provider fills the entire due page.
  const dueCandidates = [...dueRecovery, ...activeRecovery]
    .filter((row) => row.sourceId && row.nextRetryAt !== null && Date.parse(row.nextRetryAt) <= nowMs && !deferredIds.has(row.sourceId))
    .sort((a, b) => Date.parse(a.nextRetryAt!) - Date.parse(b.nextRetryAt!) || (a.sourceId ?? "").localeCompare(b.sourceId ?? ""));
  const dueBySource = new Map<string, SourceAcquisitionRecoveryDto[]>();
  for (const recovery of dueCandidates) {
    if (!recovery.sourceId) continue;
    const entries = dueBySource.get(recovery.sourceId) ?? [];
    if (!entries.some((entry) => entry.sourceKey === recovery.sourceKey)) entries.push(recovery);
    dueBySource.set(recovery.sourceId, entries);
  }
  const staleBefore = new Date(
    Date.now() - LIVENESS_INTERVAL_DAYS * 86_400_000,
  ).toISOString();

  // Each platform group is selected by one bounded query. Unowned recovery
  // keys are excluded in the database, so a growing set of conflicting rows
  // cannot hold the oldest positions forever, and there is no OFFSET paging
  // that could skip rows when earlier ones change mid-scan. A group whose
  // lookup fails or times out is skipped; the other groups still run.
  const staleGroups = [
    { group: "youtube", platforms: ["youtube", "youtube_shorts"] as MediaSourcePlatform[], limit: YOUTUBE_BATCH_LIMIT },
    { group: "tiktok", platforms: ["tiktok"] as MediaSourcePlatform[], limit: SOCIAL_PLATFORM_BATCH_LIMIT },
    { group: "instagram", platforms: ["instagram"] as MediaSourcePlatform[], limit: SOCIAL_PLATFORM_BATCH_LIMIT },
  ] as const;
  let unownedRecoveryKeys = 0;
  const staleLookupErrors: string[] = [];
  const staleSelections = await Promise.all(staleGroups.map(async ({ group, platforms, limit }) => {
    const exclusion = staleRecoveryExclusion(activeRecovery, platforms);
    unownedRecoveryKeys += exclusion.unownedKeys;
    try {
      let query = admin.from("media_sources")
        .select("id, platform, external_id, canonical_url, embeddable, removed_at")
        .in("platform", platforms)
        .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore}`);
      // Each `or` call is its own group; the plan client ANDs the groups.
      if (exclusion.filter) query = query.or(exclusion.filter);
      if (deferredSourceIds.length) query = query.not("id", "in", deferredSourceIds);
      const result = await query
        .order("last_checked_at", { ascending: true, nullsFirst: true })
        .order("id", { ascending: true })
        .limit(limit + STALE_CONFLICT_HEADROOM)
        .abortSignal(AbortSignal.timeout(SOURCE_LOOKUP_TIMEOUT_MS));
      if (result.error) throw new Error(result.error.message);
      const selected: MediaSourceRow[] = [];
      for (const source of (result.data ?? []) as MediaSourceRow[]) {
        // The database exclusion is a pre-filter; this check stays authoritative.
        if (source.external_id && !canChangeRecoveryKey(activeRecovery, source, sourceAcquisitionKey(source.platform, source.external_id))) {
          conflictingStaleIds.add(source.id);
          continue;
        }
        selected.push(source);
        if (selected.length >= limit) break;
      }
      return selected;
    } catch {
      staleLookupErrors.push(`source_stale_lookup_failed:${group}`);
      return [];
    }
  }));
  const stale = staleSelections.flat();

  const dueRows: MediaSourceRow[] = [];
  const dueCounts = { youtube: 0, tiktok: 0, instagram: 0 };
  let dueLookupFailed = false;
  const dueSourceIds = [...dueBySource.keys()];
  for (let offset = 0; offset < dueSourceIds.length; offset += 500) {
    if (dueCounts.youtube >= YOUTUBE_BATCH_LIMIT && dueCounts.tiktok >= SOCIAL_PLATFORM_BATCH_LIMIT && dueCounts.instagram >= SOCIAL_PLATFORM_BATCH_LIMIT) break;
    const ids = dueSourceIds.slice(offset, offset + 500).filter((id) =>
      (dueBySource.get(id) ?? []).some((recovery) => {
        const group = isYouTubePlatform(recovery.platform) ? "youtube" : recovery.platform;
        return dueCounts[group] < (group === "youtube" ? YOUTUBE_BATCH_LIMIT : SOCIAL_PLATFORM_BATCH_LIMIT);
      }),
    );
    if (ids.length === 0) continue;
    let data: MediaSourceRow[];
    try {
      const result = await admin.from("media_sources")
        .select("id, platform, external_id, canonical_url, embeddable, removed_at")
        .in("id", ids)
        .abortSignal(AbortSignal.timeout(SOURCE_LOOKUP_TIMEOUT_MS));
      if (result.error) throw new Error("source_recovery_candidate_lookup_failed");
      data = (result.data ?? []) as MediaSourceRow[];
    } catch {
      dueLookupFailed = true;
      break;
    }
    const sources = new Map(data.map((source) => [source.id, source]));
    for (const id of ids) {
      const source = sources.get(id);
      const recoveries = dueBySource.get(id) ?? [];
      const matches = source ? recoveries.filter((recovery) => recoveryMatchesSource(recovery, source)) : [];
      unmatchedDueKeys += recoveries.length - matches.length;
      if (!source || matches.length === 0) continue;
      if (source.external_id && !canChangeRecoveryKey(activeRecovery, source, sourceAcquisitionKey(source.platform, source.external_id))) continue;
      const group = isYouTubePlatform(source.platform) ? "youtube" : source.platform;
      const limit = group === "youtube" ? YOUTUBE_BATCH_LIMIT : SOCIAL_PLATFORM_BATCH_LIMIT;
      if (dueCounts[group] >= limit) continue;
      dueCounts[group] += 1;
      dueRows.push(source);
    }
  }
  const recoveryBySourceId = new Map(activeRecovery.flatMap((row) => row.sourceId ? [[row.sourceId, row] as const] : []));
  const candidateRows = [...new Map([...(dueRows ?? []), ...stale].map((row) => [row.id, row])).values()];
  const rows = candidateRows.filter((row) => {
    // A second recovery key for the same source must not bypass a quarantine
    // or a later retry time simply because its due record was returned last.
    if (deferredIds.has(row.id)) return false;
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
  for (const row of [...youtubeRows, ...oembedRows]) observations[row.platform].selected += 1;

  let youtube = { checked: 0, removed: 0, hidden: 0, failed: 0, errors: [] as string[] };
  const oembed = { checked: 0, removed: 0, failed: 0, errors: [] as string[], deferred_by_deadline: 0 };
  let firstError: string | undefined = [
    ...staleLookupErrors,
    ...(dueLookupFailed ? ["source_recovery_candidate_lookup_failed"] : []),
  ].join("; ") || undefined;

  // Run the three providers side by side: a slow YouTube batch or TikTok
  // request must not hold another provider behind it. Wait for all of them
  // before auditing or invalidating caches.
  const [youtubeResult, ...socialResults] = await Promise.allSettled([
    refreshYouTubeSources(admin, youtubeRows, observations, activeRecovery),
    ...(["tiktok", "instagram"] as const).map((platform) =>
      refreshOEmbedSources(admin, oembedRows.filter((row) => row.platform === platform), observations, activeRecovery, providerDeadlineMs),
    ),
  ]);
  if (youtubeResult.status === "fulfilled") {
    youtube = youtubeResult.value;
  } else {
    firstError = firstError ?? (youtubeResult.reason instanceof Error ? youtubeResult.reason.message : String(youtubeResult.reason));
  }
  for (const result of socialResults) {
    if (result.status === "rejected") {
      firstError = firstError ?? (result.reason instanceof Error ? result.reason.message : String(result.reason));
      continue;
    }
    const value = result.value as Awaited<ReturnType<typeof refreshOEmbedSources>>;
    oembed.checked += value.checked;
    oembed.removed += value.removed;
    oembed.failed += value.failed;
    oembed.deferred_by_deadline += value.deferred_by_deadline;
    oembed.errors.push(...value.errors);
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
    observations,
    recovery_unmatched_due_keys: unmatchedDueKeys,
    recovery_conflicting_stale_sources: conflictingStaleIds.size,
    recovery_unowned_keys: unownedRecoveryKeys,
    ...(firstError ? { error: firstError } : {}),
  };

  const { error: jobError } = await admin.from("job_runs").insert({
    job_name: "refresh_media_sources",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    ok: result.status === "ok",
    detail: result,
  });
  if (jobError) return { ...result, status: "partial", error: jobError.message };

  return result;
}
