import "server-only";

import { getOEmbed } from "@/lib/oembed";
import { createAdminClient } from "@/lib/supabase/admin";
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
};

export class SourceIngestionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 502,
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
    );
  }

  if (input.targetMemeId) {
    const { data: meme, error } = await admin
      .from("memes")
      .select("id")
      .eq("id", input.targetMemeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!meme) throw new SourceIngestionError("대상 밈을 찾지 못했습니다.", 404);
  }

  const metadata = await getOEmbed(normalized.canonicalUrl).catch((error) => {
    throw new SourceIngestionError(
      error instanceof Error ? error.message : "메타데이터를 가져오지 못했습니다.",
      502,
    );
  });
  if (metadata.contentId && metadata.contentId !== normalized.externalId) {
    throw new SourceIngestionError("플랫폼 메타데이터가 URL과 일치하지 않습니다.", 502);
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
  if (error) throw new Error(error.message);

  const record = data?.[0];
  if (
    !record ||
    (record.status !== "metadata_ready" &&
      record.status !== "linked" &&
      record.status !== "duplicate")
  ) {
    throw new Error("수집 기록을 저장하지 못했습니다.");
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
  };
}
