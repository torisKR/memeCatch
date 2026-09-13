import "server-only";

import { getOEmbed, OEmbedError } from "@/lib/oembed";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sourceIngestionFailure,
  type SourceIngestionErrorCode,
} from "./ingestion-errors";
import {
  recordSourceAcquisitionFailure,
  resolveSourceAcquisitionFailure,
  sourceAcquisitionKey,
} from "./recovery.server";
import { normalizeSourceUrl, type MediaSourcePlatform } from "./url";

const RIGHTS_MODE = "METADATA_ONLY" as const;
const METADATA_TTL_MS = 30 * 86_400_000;

type AdminClient = ReturnType<typeof createAdminClient>;

export type SourceIngestionResult = {
  id: string;
  status: "metadata_ready" | "linked" | "duplicate";
  platform: MediaSourcePlatform;
  externalId: string;
  canonicalUrl: string;
  title: string | null;
  author: string | null;
  rightsMode: typeof RIGHTS_MODE;
  duplicate: boolean;
  warning?: "recovery_resolution_failed";
};

export class SourceIngestionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 502 | 503,
    readonly code: SourceIngestionErrorCode,
    readonly retryable: boolean = sourceIngestionFailure(code).retryable,
    readonly nextRetryAt: string | null = null,
  ) {
    super(message);
  }
}

export async function ingestSource(
  input: { url: string; targetMemeId?: string },
  submittedBy: string,
  admin: AdminClient = createAdminClient(),
): Promise<SourceIngestionResult> {
  const normalized = normalizeSourceUrl(input.url);
  if (!normalized) {
    throw new SourceIngestionError(
      "지원하는 플랫폼의 최종 HTTPS 공개 URL이 필요합니다.",
      400,
      "invalid_url",
    );
  }

  if (input.targetMemeId) {
    const { data: meme, error } = await admin
      .from("memes")
      .select("id")
      .eq("id", input.targetMemeId)
      .maybeSingle();
    if (error) {
      throw new SourceIngestionError("대상 밈을 확인하지 못했습니다.", 503, "db_failure");
    }
    if (!meme) {
      throw new SourceIngestionError("대상 밈을 찾지 못했습니다.", 404, "missing_meme");
    }
  }

  const sourceKey = sourceAcquisitionKey(normalized.platform, normalized.externalId);
  const attempt = 1;
  const attemptStartedAt = new Date();
  const attemptIdempotencyKey = `ingest:${sourceKey}:${attemptStartedAt.toISOString()}`;
  const metadata = await getOEmbed(normalized.canonicalUrl).catch(async (error) => {
    const ingestionError = error instanceof OEmbedError
      ? new SourceIngestionError(
          error.message,
          error.status === 502 ? 502 : 404,
          error.status === 502 ? "provider_transient" : "provider_uncertain",
        )
      : new SourceIngestionError(
          error instanceof Error ? error.message : "메타데이터를 가져오지 못했습니다.",
          502,
          "provider_transient",
        );
    const recovery = await recordSourceAcquisitionFailure({
      sourceKey,
      idempotencyKey: attemptIdempotencyKey,
      platform: normalized.platform,
      externalId: normalized.externalId,
      canonicalUrl: normalized.canonicalUrl,
      code: ingestionError.code,
      attempt,
      occurredAt: attemptStartedAt,
    }, admin);
    throw new SourceIngestionError(
      ingestionError.message,
      ingestionError.status,
      ingestionError.code,
      ingestionError.retryable,
      recovery.nextRetryAt,
    );
  });
  if (metadata.contentId && metadata.contentId !== normalized.externalId) {
    const error = new SourceIngestionError(
      "플랫폼 메타데이터가 URL과 일치하지 않습니다.",
      502,
      "metadata_mismatch",
    );
    await recordSourceAcquisitionFailure({
      sourceKey,
      idempotencyKey: `${attemptIdempotencyKey}:mismatch`,
      platform: normalized.platform,
      externalId: normalized.externalId,
      canonicalUrl: normalized.canonicalUrl,
      code: error.code,
      attempt,
      occurredAt: attemptStartedAt,
    }, admin);
    throw error;
  }

  const refreshedAt = new Date();
  const { data, error } = await admin.rpc("record_source_ingestion", {
    p_platform: normalized.platform,
    p_external_id: normalized.externalId,
    p_canonical_url: normalized.canonicalUrl,
    p_title: metadata.title,
    p_channel_name: metadata.authorName,
    p_submitted_by: submittedBy,
    p_target_meme_id: input.targetMemeId ?? null,
    p_processing_rights_mode: RIGHTS_MODE,
    p_metadata_refreshed_at: refreshedAt.toISOString(),
    p_metadata_expires_at: new Date(
      refreshedAt.getTime() + METADATA_TTL_MS,
    ).toISOString(),
  });
  if (error) {
    try {
      const recovery = await recordSourceAcquisitionFailure({
        sourceKey,
         idempotencyKey: `${attemptIdempotencyKey}:db`,
        platform: normalized.platform,
        externalId: normalized.externalId,
        canonicalUrl: normalized.canonicalUrl,
        code: "db_failure",
        attempt,
         occurredAt: attemptStartedAt,
      }, admin);
      throw new SourceIngestionError(error.message, 503, "db_failure", true, recovery.nextRetryAt);
    } catch (recoveryError) {
      if (recoveryError instanceof SourceIngestionError) throw recoveryError;
      throw new SourceIngestionError(error.message, 503, "db_failure");
    }
  }

  const record = data?.[0];
  if (
    !record ||
    (record.status !== "metadata_ready" &&
      record.status !== "linked" &&
      record.status !== "duplicate")
  ) {
    throw new SourceIngestionError("수집 기록을 저장하지 못했습니다.", 503, "db_failure");
  }

  let warning: SourceIngestionResult["warning"];
  try {
    await resolveSourceAcquisitionFailure({
      sourceKey,
      attemptIdempotencyKey,
      attemptStartedAt,
      resolvedAt: refreshedAt,
    }, admin);
  } catch {
    warning = "recovery_resolution_failed";
  }
  return {
    id: record.ingestion_id,
    status: record.status,
    platform: normalized.platform,
    externalId: normalized.externalId,
    canonicalUrl: normalized.canonicalUrl,
    title: metadata.title,
    author: metadata.authorName,
    rightsMode: RIGHTS_MODE,
    duplicate: record.duplicate,
    ...(warning ? { warning } : {}),
  };
}
