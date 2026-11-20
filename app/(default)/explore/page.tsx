import type { Metadata } from "next";
import Link from "next/link";
import type { DbClient } from "@/lib/db/types";
import { createStaticClient } from "@/lib/db/server";
import type { Database } from "@/lib/database.types";
import { UNAVAILABLE_FILTER } from "@/lib/content-availability";
import { LIST_COLUMNS, type MemeListItem } from "@/lib/queries";
import {
  AI_MEME_DISPLAY_CATEGORY,
  AI_MEME_TOPIC_TAG,
  DIFFICULTY,
  LIFECYCLE_STATUS,
  expandDisplayCategoryTokens,
  expandToLegacyCategories,
} from "@/lib/labels";
import { ExploreFilters } from "@/components/explore-filters";
import {
  ExploreGrid,
  type ExploreFilters as Filters,
  type SortKey,
} from "@/components/explore-grid";
import { ExploreCollectionJsonLd } from "@/components/json-ld";
import { isSocialPlatform, type SocialPlatform } from "@/lib/source-platform";
import { curatedPassesIndexGate, curatedSearchCards, findCuratedCoreMeme } from "@/lib/curated-memes";
import { mergeSearchPresentationItems, searchPresentationKey } from "@/lib/search-presentation";
import { limitQueryToIds } from "@/lib/index-gate";
import { loadDiscoveryIndex } from "@/lib/index-gate.server";
import { AdsenseScript } from "@/components/adsense-script";
import { collectIndexableWindow, THIN_MEME_BODY_COLUMNS } from "@/lib/thin-meme";
import { qualifySearchPreviews } from "@/lib/search-preview.server";
import { createPreviewDeadlineDb, withPreviewDeadline } from "@/lib/explore-preview-deadline.server";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";

/**
 * 레인 B 여정2 — 전체 탐색 페이지.
 * searchParams(필터/정렬)를 읽어 첫 페이지를 서버에서 조회하고,
 * <ExploreFilters>(URL 동기화) + <ExploreGrid>(무한 스크롤)를 렌더한다.
 * searchParams 사용 → 동적 렌더. 쿠키 미사용(createStaticClient).
 *
 * ⚠️ 아래 필터→쿼리 매핑은 components/explore-grid.tsx의 buildMemesQuery와
 *    반드시 동기화한다("use client" 경계라 런타임 공유 불가 → 의도적 복제).
 */

const EXPLORE_DESCRIPTION =
  "카테고리·연도·난이도로 거르고 급상승·최신·인기·논쟁 순으로 전체 밈을 탐색해요.";

export const metadata: Metadata = {
  title: "밈 탐색",
  description: EXPLORE_DESCRIPTION,
  alternates: { canonical: "/explore" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "밈 탐색",
    description: EXPLORE_DESCRIPTION,
    url: "/explore",
    images: [ogDefaultImageDescriptor("ko")],
  },
};

// components/explore-grid.tsx의 PAGE_SIZE와 동일하게 유지
const PAGE_SIZE = 24;
const SEARCH_LIMIT = 50; // components/explore-grid.tsx의 SEARCH_LIMIT과 동일
const YEAR_RANGES: Record<string, [number, number]> = {
  "2020s": [2020, 2029],
  "2010s": [2010, 2019],
  "2000s": [2000, 2009],
};

const DIFFICULTY_KEYS = Object.keys(DIFFICULTY);
const LIFECYCLE_KEYS = Object.keys(LIFECYCLE_STATUS);
const MEDIA_KEYS = ["image", "video", "audio", "text", "embed"];
const YEAR_KEYS = Object.keys(YEAR_RANGES);
const SORT_KEYS: SortKey[] = ["trending", "recent", "popular", "controversial"];

type RawParams = Record<string, string | string[] | undefined>;

function asArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

function one(
  v: string | string[] | undefined,
  allowed: readonly string[]
): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && allowed.includes(s) ? s : undefined;
}

function parseFilters(sp: RawParams): Filters {
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const displayCategories = expandDisplayCategoryTokens(asArray(sp.category));
  return {
    categories: expandToLegacyCategories(displayCategories),
    topicTag: displayCategories.includes(AI_MEME_DISPLAY_CATEGORY)
      ? AI_MEME_TOPIC_TAG
      : undefined,
    difficulty: one(sp.difficulty, DIFFICULTY_KEYS) as Filters["difficulty"],
    lifecycle: one(sp.lifecycle, LIFECYCLE_KEYS) as Filters["lifecycle"],
    media: one(sp.media, MEDIA_KEYS) as Filters["media"],
    year: one(sp.year, YEAR_KEYS),
    platform: (() => {
      const candidate = Array.isArray(sp.platform) ? sp.platform[0] : sp.platform;
      return isSocialPlatform(candidate) ? candidate : undefined;
    })(),
    sort: (one(sp.sort, SORT_KEYS) ?? "trending") as SortKey,
    q: rawQ?.trim() || undefined,
  };
}

function selectForPlatform(platform?: SocialPlatform, topicTag?: string) {
  const contents = platform
    ? "meme_contents(type, thumbnail_url, is_representative, platform, url, content_id, availability, moderation_status, manual_video_verified), matched_contents:meme_contents!inner(platform, url, availability, moderation_status)"
    : "meme_contents(type, thumbnail_url, is_representative, platform, url, content_id, availability, moderation_status, manual_video_verified)";
  const topic = topicTag
    ? ", topic_tags:meme_tags_map!inner(tags!inner(name))"
    : "";
  return `${LIST_COLUMNS}, ${THIN_MEME_BODY_COLUMNS}, ${contents}, meme_sources(platform, source_url, hidden_from_public), meme_tags_map(tag_id), meme_market_profiles(market_code, role, review_state)${topic}`;
}

function withTopicTag<T extends {
  eq: (column: string, value: string) => T;
}>(query: T, topicTag?: string): T {
  return topicTag
    ? query.eq("topic_tags.tags.name", topicTag)
    : query;
}

function withPublicContent<T extends {
  eq: (column: string, value: string) => T;
  not: (column: string, operator: string, value: string) => T;
}>(query: T): T {
  return query
    .eq("matched_contents.moderation_status", "approved")
    // 렌더 경로와 같은 제외 목록을 쓴다 — dead와 region_blocked를 함께 뺀다.
    .not("matched_contents.availability", "in", UNAVAILABLE_FILTER);
}

function withPlatform<T extends {
  ilike: (column: string, value: string) => T;
  not: (column: string, operator: string, value: string) => T;
}>(query: T, platform?: SocialPlatform): T {
  if (platform === "youtube") {
    return query
      .ilike("matched_contents.platform", "youtube")
      .not("matched_contents.url", "ilike", "%/shorts/%");
  }
  if (platform === "youtube_shorts") {
    return query
      .ilike("matched_contents.platform", "youtube")
      .ilike("matched_contents.url", "%/shorts/%");
  }
  if (platform === "tiktok") return query.ilike("matched_contents.platform", "tiktok");
  if (platform === "instagram") return query.ilike("matched_contents.platform", "instagram");
  return query;
}

function buildQuery(
  db: DbClient,
  filters: Filters,
  indexableIds: readonly string[] | undefined,
) {
  // 검색어가 있으면 search_memes RPC 위에 동일 필터/정렬을 얹는다
  // (components/explore-grid.tsx의 buildMemesQuery와 반드시 동기화).
  if (filters.q) {
    let sq = db
      .rpc(filters.topicTag ? "search_ai_memes" : "search_memes", {
        p_query: filters.q,
        p_limit: SEARCH_LIMIT,
      })
      .select(selectForPlatform(filters.platform));
    if (filters.platform) sq = withPublicContent(sq);
    if (filters.categories.length > 0) sq = sq.in("category", filters.categories);
    if (filters.difficulty) sq = sq.eq("difficulty", filters.difficulty);
    if (filters.lifecycle) sq = sq.eq("lifecycle_status", filters.lifecycle);
    if (filters.media) sq = sq.eq("media_type", filters.media);
    if (filters.year && YEAR_RANGES[filters.year]) {
      const [lo, hi] = YEAR_RANGES[filters.year];
      sq = sq.gte("origin_year", lo).lte("origin_year", hi);
    }
    sq = withPlatform(sq, filters.platform);
    if (filters.sort === "controversial") sq = sq.eq("sentiment", "controversial");
    if (filters.sort === "recent" || filters.sort === "controversial") {
      sq = sq.order("published_at", { ascending: false, nullsFirst: false });
    } else {
      sq = sq.order("trend_score", { ascending: false });
    }
    sq = sq.order("id", { ascending: false });
    return limitQueryToIds(sq, indexableIds);
  }

  let q = db
    .from("memes")
    .select(selectForPlatform(filters.platform, filters.topicTag))
    .in("moderation_status", ["approved", "limited"]);
  if (filters.platform) q = withPublicContent(q);
  q = withTopicTag(q, filters.topicTag);

  if (filters.categories.length > 0) q = q.in("category", filters.categories);
  if (filters.difficulty) q = q.eq("difficulty", filters.difficulty);
  if (filters.lifecycle) q = q.eq("lifecycle_status", filters.lifecycle);
  if (filters.media) q = q.eq("media_type", filters.media);
  if (filters.year && YEAR_RANGES[filters.year]) {
    const [lo, hi] = YEAR_RANGES[filters.year];
    q = q.gte("origin_year", lo).lte("origin_year", hi);
  }
  q = withPlatform(q, filters.platform);
  if (filters.sort === "controversial") q = q.eq("sentiment", "controversial");

  if (filters.sort === "recent" || filters.sort === "controversial") {
    q = q.order("published_at", { ascending: false, nullsFirst: false });
  } else {
    q = q.order("trend_score", { ascending: false });
  }
  q = q.order("id", { ascending: false });
  return limitQueryToIds(q, indexableIds);
}

/** 필터 상태로부터 안정적인 remount 키 — 필터 변경 시 그리드 상태 초기화 */
function filterKey(f: Filters): string {
  return [
    f.sort,
    [...f.categories].sort().join(","),
    f.topicTag ?? "",
    f.difficulty ?? "",
    f.lifecycle ?? "",
    f.media ?? "",
    f.year ?? "",
    f.platform ?? "",
    f.q ?? "",
  ].join("|");
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const initialLoad = await (async (): Promise<{
      items: MemeListItem[];
      alternatives: MemeListItem[];
      unavailable: boolean;
      dbCount: number;
      hasMore: boolean;
      indexableIds: string[];
    }> => {
      const discovery = await loadDiscoveryIndex();
      const indexableIds = discovery.ok ? [...discovery.ids] : [];
      const curated = filters.q
        ? curatedSearchCards(filters.q).filter((card) => {
            const meme = findCuratedCoreMeme(card.short_id);
            return meme ? curatedPassesIndexGate(meme) : false;
          })
        : [];
      const failed = {
        items: [] as MemeListItem[],
        alternatives: [] as MemeListItem[],
        unavailable: true,
        dbCount: 0,
        hasMore: false,
        indexableIds,
      };
      if (!discovery.ok) return failed;
      try {
        const db = createStaticClient();
        let queryFailed = false;
        const page = await collectIndexableWindow(
          async (from, to) => {
            const { data, error } = await buildQuery(
              db,
              filters,
              indexableIds,
            ).range(from, to);
            // Curated cards are not a successful catalog read. Showing them with
            // unavailable:false hid the retry state when the database failed.
            if (error) {
              queryFailed = true;
              return [];
            }
            return (data ?? []) as unknown as MemeListItem[];
          },
          0,
          PAGE_SIZE,
          { pageSize: PAGE_SIZE },
        );
        if (queryFailed) return failed;
        const rows = page.items;
        const items = mergeSearchPresentationItems(curated, rows) as MemeListItem[];
        const winners = new Map(items.map((item) => [searchPresentationKey(item), item]));
        // Preserve observed suppressed database rows for a public recheck.
        const alternatives = rows.filter((item) => {
          const winner = winners.get(searchPresentationKey(item));
          return winner && winner.id !== item.id && winner.short_id !== item.short_id;
        }) as MemeListItem[];
        return {
          items,
          alternatives,
          unavailable: false,
          dbCount: page.scanned,
          hasMore: page.hasMore,
          indexableIds,
        };
      } catch {
        return failed;
      }
    })();

  const previewResult = await withPreviewDeadline(async (signal) => {
    let failed = false;
    const previews = await qualifySearchPreviews(initialLoad.items, {
      client: createPreviewDeadlineDb("service_role"), signal, onFailure: () => { failed = true; },
    });
    if (failed) throw new Error("preview ledger unavailable");
    return previews;
  });
  const initialPreviews = previewResult ?? initialLoad.items.map(() => []);

  return (
    <main className="bg-background pb-14 text-foreground">
      <AdsenseScript />
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <ExploreCollectionJsonLd />
        {/* The title is the page, not a card: no box around it. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-2">
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">밈 탐색</h1>
            <p className="mt-2 max-w-xl text-base text-muted">
              검색하고, 필요한 조건만 골라 바로 결과를 확인하세요.
            </p>
          </div>
          <Link
            href="/collections"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline decoration-border decoration-2 underline-offset-4 transition-colors hover:decoration-accent"
          >
            테마별 모음 보기
          </Link>
        </div>

        <ExploreFilters />

        <section
          aria-label="밈 탐색 결과"
          className="mt-6"
        >
          <ExploreGrid
            key={filterKey(filters)}
            initial={initialLoad.items}
            initialAlternatives={initialLoad.alternatives}
            initialPreviews={initialPreviews}
            initialPreviewUnavailable={previewResult === null}
            initialOffset={initialLoad.dbCount}
            hasMoreInitial={initialLoad.hasMore}
            catalogUnavailable={initialLoad.unavailable}
            filters={filters}
            indexableIds={initialLoad.indexableIds}
          />
        </section>
      </div>
    </main>
  );
}
