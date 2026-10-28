import "server-only";

import { contentDepth } from "@/lib/content-depth";
import type { Database } from "@/lib/database.types";
import { isRenderableContent } from "@/lib/content-availability";
import { resolveMemeDelivery } from "@/lib/meme-delivery";
import { publicEditorialEligibilityInput } from "@/lib/meme-public-detail";
import { LIST_COLUMNS, type MemeListItem } from "@/lib/queries";
import { citableSources, evidenceTimestamp, publicSourceUrl } from "@/lib/source-links";
import { filterPublicMemeMedia } from "@/lib/sources/public-links.server";
import { createStaticClient } from "@/lib/supabase/server";

const PAGE_SIZE = 200;
const MAX_PAGES = 10;
const MAX_HOME_ENTRIES = 6;

export const EDITORIAL_HOME_SELECT =
  `${LIST_COLUMNS}, description, origin, usage_note, caution, usage_examples, origin_kind, moderation_status, published_at,` +
  " meme_sources(*), meme_contents(*)," +
  " meme_tags_map(tag_id)";

type MemeRow = Database["public"]["Tables"]["memes"]["Row"];
type MemeSourceRow = Database["public"]["Tables"]["meme_sources"]["Row"];
type MemeContentRow = Database["public"]["Tables"]["meme_contents"]["Row"];

type EditorialHomeRow = Pick<
  MemeRow,
  | "id"
  | "short_id"
  | "slug"
  | "title"
  | "summary"
  | "category"
  | "safety_level"
  | "lifecycle_status"
  | "media_type"
  | "origin_year"
  | "trend_score"
  | "description"
  | "origin"
  | "usage_note"
  | "caution"
  | "usage_examples"
  | "origin_kind"
  | "moderation_status"
  | "published_at"
> & {
  meme_sources: MemeSourceRow[];
  meme_contents: MemeContentRow[];
  meme_tags_map: { tag_id: string }[];
};

export type EditorialHomeMeme = MemeListItem & {
  meme_contents: Array<
    Pick<MemeContentRow, "thumbnail_url" | "is_representative"> &
      Partial<Pick<MemeContentRow, "availability" | "moderation_status">>
  >;
};

export type EditorialHomeResult =
  | { status: "ready"; items: EditorialHomeMeme[] }
  | { status: "unavailable"; items: [] };

function unavailableResult(
  failure: "query_error" | "missing_data" | "exception",
  page?: number,
): EditorialHomeResult {
  // 오류 객체·URL·응답 본문은 로그에 넣지 않는다. 공개 홈 진단에 필요한 것은
  // 실패 단계와 bounded page뿐이며, 원문 오류에는 키나 소스 URL이 섞일 수 있다.
  console.error("[home-editorial] recommendation query unavailable", {
    failure,
    ...(page === undefined ? {} : { page }),
  });
  return { status: "unavailable", items: [] };
}

function publicThumbnailUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/api/media/") && !value.startsWith("//")) return value;
  return publicSourceUrl(value);
}

function hasDistinctCopy(row: EditorialHomeRow): boolean {
  const title = row.title.trim();
  const summary = row.summary.trim();
  return Boolean(title && summary && title.toLocaleLowerCase() !== summary.toLocaleLowerCase());
}

function isEditorialStaticCandidate(row: EditorialHomeRow): boolean {
  if (
    row.moderation_status !== "approved" ||
    row.origin_kind !== "catalog" ||
    !["green", "yellow"].includes(row.safety_level) ||
    !evidenceTimestamp(row.published_at) ||
    !hasDistinctCopy(row)
  ) {
    return false;
  }

  return true;
}

function isEditorialHomeCandidate(
  row: EditorialHomeRow,
  publicDepth: ReturnType<typeof publicEditorialEligibilityInput>,
): boolean {
  return (
    isEditorialStaticCandidate(row) &&
    citableSources(publicDepth.meme_sources).length > 0 &&
    contentDepth(publicDepth).isSubstantial
  );
}

function toHomeMeme(
  row: EditorialHomeRow,
  renderableContents: readonly MemeContentRow[],
): EditorialHomeMeme {
  const meme_contents = renderableContents
    .filter(isRenderableContent)
    .map((content) => ({
      thumbnail_url: publicThumbnailUrl(content.thumbnail_url),
      is_representative: content.is_representative,
      availability: content.availability,
      moderation_status: content.moderation_status,
    }));

  return {
    id: row.id,
    short_id: row.short_id,
    slug: row.slug,
    title: row.title.trim(),
    summary: row.summary.trim(),
    category: row.category,
    safety_level: row.safety_level,
    lifecycle_status: row.lifecycle_status,
    media_type: row.media_type,
    origin_year: row.origin_year,
    trend_score: row.trend_score,
    meme_contents,
  };
}

/** Read-only, bounded editorial selection for the Korean home page. */
export async function getEditorialHomeMemes(limit = MAX_HOME_ENTRIES): Promise<EditorialHomeResult> {
  const requested = Math.min(MAX_HOME_ENTRIES, Math.max(0, Math.floor(limit)));
  if (requested === 0) return { status: "ready", items: [] };

  try {
    const supabase = createStaticClient({ cachePublicCatalog: true });
    const selected: EditorialHomeMeme[] = [];
    const seen = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("memes")
        .select(EDITORIAL_HOME_SELECT)
        .eq("moderation_status", "approved")
        .eq("origin_kind", "catalog")
        .in("safety_level", ["green", "yellow"])
        .not("published_at", "is", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) return unavailableResult("query_error", page);
      if (!data) return unavailableResult("missing_data", page);

      const pageRows = data as unknown as EditorialHomeRow[];
      const candidates = pageRows.filter(
        (row) => !seen.has(row.id) && isEditorialStaticCandidate(row),
      );
      const publicMedia = candidates.length > 0
        ? await filterPublicMemeMedia({
            sources: candidates.flatMap((row) => row.meme_sources ?? []),
            contents: candidates.flatMap((row) => row.meme_contents ?? []),
          })
        : { sources: [], contents: [] };
      const publicSources = new Set(publicMedia.sources);
      const publicContents = new Set(publicMedia.contents);

      for (const row of candidates) {
        const delivery = resolveMemeDelivery({
          sources: (row.meme_sources ?? []).filter((source) => publicSources.has(source)),
          contents: (row.meme_contents ?? []).filter((content) => publicContents.has(content)),
        });
        const publicDepth = publicEditorialEligibilityInput({
          meme: row,
          originalSources: delivery.originalSources,
          renderableContents: delivery.renderableContents,
        });
        if (!isEditorialHomeCandidate(row, publicDepth)) continue;
        seen.add(row.id);
        selected.push(toHomeMeme(row, delivery.renderableContents));
        if (selected.length === requested) return { status: "ready", items: selected };
      }

      if (data.length < PAGE_SIZE) break;
    }

    return { status: "ready", items: selected };
  } catch {
    return unavailableResult("exception");
  }
}
