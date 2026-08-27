import "server-only";

import { isRenderableContent } from "@/lib/content-availability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStaticClient } from "@/lib/supabase/server";
import {
  isSocialPlatform,
  SOURCE_PLATFORM_META,
  sourcePlatformFromReference,
  type SocialPlatform,
} from "@/lib/source-platform";
import type { GlobalFeedItem } from "@/lib/global-feed.types";

/**
 * 글로벌 피드 — 플랫폼별 공개 밈 콘텐츠 조회.
 * 승인된 memes × 승인·생존 meme_contents × 승인된 출처 권리 원장으로
 * 실제 공개 가능한 콘텐츠만 trend_score 순으로 노출한다.
 * YouTube 탭은 youtube + youtube_shorts를 함께 담는다.
 */

type FeedContentRow = {
  platform: string | null;
  content_id: string | null;
  url: string | null;
  thumbnail_url: string | null;
  availability: string;
  moderation_status: string;
  is_representative: boolean;
};

type ApprovedSourceRow = {
  meme_id: string;
  media_sources: {
    platform: string;
    external_id: string | null;
    canonical_url: string;
  } | null;
};

const EMBEDDABLE_RIGHTS = [
  "official_embed",
  "creator_permission",
  "creative_commons",
  "public_data",
] as const;
const FEED_BATCH_SIZE = 48;

type FeedRow = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  safety_level: string;
  lifecycle_status: string;
  media_type: string;
  origin_year: number | null;
  trend_score: number | null;
  meme_contents: FeedContentRow[];
};

/** 목록 카드가 실제로 읽는 컬럼만 명시 — 전송량 절감(lib/queries.ts LIST_COLUMNS과 동일 컬럼셋). */
const FEED_COLUMNS = [
  "id",
  "short_id",
  "slug",
  "title",
  "summary",
  "category",
  "safety_level",
  "lifecycle_status",
  "media_type",
  "origin_year",
  "trend_score",
] as const;

function pickContent(row: FeedRow, approvedSources: ApprovedSourceRow["media_sources"][]): {
  platform: SocialPlatform;
  url: string | null;
  thumbnail_url: string | null;
} | null {
  const alive = (row.meme_contents ?? []).filter(
    (content) =>
      isRenderableContent(content) &&
      approvedSources.some(
        (source) =>
          source &&
          sourcePlatformFromReference({ platform: source.platform, url: source.canonical_url }) ===
            sourcePlatformFromReference(content) &&
          ((content.url && content.url === source.canonical_url) ||
            (content.content_id && content.content_id === source.external_id)),
      ),
  );
  const best =
    alive.find((content) => content.is_representative && content.thumbnail_url) ??
    alive.find((content) => content.thumbnail_url) ??
    alive[0];
  if (!best?.platform) return null;
  const platform = sourcePlatformFromReference({
    platform: best.platform.replaceAll("_", " "),
    url: best.url,
  });
  if (!platform || !isSocialPlatform(platform)) return null;
  return {
    platform,
    url: best.url,
    thumbnail_url: best.thumbnail_url,
  };
}

export type GlobalFeedResult = {
  status: "ready" | "empty" | "error";
  items: GlobalFeedItem[];
};

/**
 * 지정 플랫폼에 공개 콘텐츠가 붙은 밈을 최대 limit건 반환.
 * 하나의 밈이 같은 플랫폼 콘텐츠를 여러 개 갖으면 첫 행만 남긴다(inner 조인 중복 제거).
 * 정상 조회는 ready/empty, 조회 실패는 error로 구분하며 두 경우 모두 items는 안전한 배열이다.
 */
export async function getGlobalFeed(
  platforms: readonly [SocialPlatform, ...SocialPlatform[]],
  limit = 24
): Promise<GlobalFeedResult> {
  try {
    const supabase = createStaticClient();
    const storedPlatforms = [
      ...new Set(
        platforms.flatMap((platform) => [platform, SOURCE_PLATFORM_META[platform].label]),
      ),
    ];
    const seen = new Set<string>();
    const items: GlobalFeedItem[] = [];
    let admin: ReturnType<typeof createAdminClient> | undefined;
    for (let from = 0; items.length < limit; from += FEED_BATCH_SIZE) {
      const { data, error } = await supabase
        .from("memes")
        .select(
          `${FEED_COLUMNS.join(", ")}, meme_contents!inner(platform, content_id, url, thumbnail_url, availability, moderation_status, is_representative)`
        )
        .eq("moderation_status", "approved")
        .in("meme_contents.platform", storedPlatforms)
        .eq("meme_contents.moderation_status", "approved")
        .eq("meme_contents.availability", "live")
        .order("trend_score", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + FEED_BATCH_SIZE - 1);
      if (error || !data) return { status: "error", items: [] };

      const rows = data as unknown as FeedRow[];
      if (rows.length === 0) break;
      admin ??= createAdminClient();
      const { data: ledgerData, error: ledgerError } = await admin
        .from("meme_media")
        .select(
          "meme_id, media_sources!inner(platform, external_id, canonical_url, embeddable, removed_at)",
        )
        .in("meme_id", [...new Set(rows.map((row) => row.id))])
        .eq("review_state", "approved")
        .in("rights_basis", [...EMBEDDABLE_RIGHTS])
        .eq("media_sources.embeddable", true)
        .is("media_sources.removed_at", null);
      if (ledgerError || !ledgerData) return { status: "error", items: [] };

      const approvedByMeme = new Map<string, ApprovedSourceRow["media_sources"][]>();
      for (const ledger of ledgerData as unknown as ApprovedSourceRow[]) {
        const sources = approvedByMeme.get(ledger.meme_id) ?? [];
        sources.push(ledger.media_sources);
        approvedByMeme.set(ledger.meme_id, sources);
      }

      for (const raw of rows) {
        if (seen.has(raw.id)) continue;
        const content = pickContent(raw, approvedByMeme.get(raw.id) ?? []);
        if (!content) continue;
        seen.add(raw.id);
        items.push({
          id: raw.id,
          short_id: raw.short_id,
          slug: raw.slug,
          title: raw.title,
          summary: raw.summary,
          category: raw.category,
          safety_level: raw.safety_level,
          lifecycle_status: raw.lifecycle_status,
          media_type: raw.media_type,
          origin_year: raw.origin_year,
          trend_score: raw.trend_score,
          platform: content.platform,
          content_url: content.url,
          thumbnail_url: content.thumbnail_url,
        });
        if (items.length >= limit) break;
      }
      if (rows.length < FEED_BATCH_SIZE) break;
    }
    return { status: items.length ? "ready" : "empty", items };
  } catch {
    return { status: "error", items: [] };
  }
}
