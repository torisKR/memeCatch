import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
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
import { getSocialPlatformCounts } from "@/lib/social-platform-counts.server";
import { curatedSearchCards } from "@/lib/curated-memes";
import { AdsenseScript } from "@/components/adsense-script";

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
    ? "meme_contents!inner(thumbnail_url, is_representative, platform, url)"
    : "meme_contents(thumbnail_url, is_representative, platform, url)";
  // LIST_COLUMNS: 목록 카드가 읽는 컬럼만 — 장문 컬럼 과다 전송 방지(lib/queries.ts 참조)
  const topic = topicTag ? ", meme_tags_map!inner(tags!inner(name))" : "";
  return `${LIST_COLUMNS}, ${contents}, meme_sources(platform, source_url), meme_market_profiles(market_code, role, review_state)${topic}`;
}

function withTopicTag<T extends {
  eq: (column: string, value: string) => T;
}>(query: T, topicTag?: string): T {
  return topicTag
    ? query.eq("meme_tags_map.tags.name", topicTag)
    : query;
}

function withPublicContent<T extends {
  eq: (column: string, value: string) => T;
  not: (column: string, operator: string, value: string) => T;
}>(query: T): T {
  return query
    .eq("meme_contents.moderation_status", "approved")
    // 렌더 경로와 같은 제외 목록을 쓴다 — dead와 region_blocked를 함께 뺀다.
    .not("meme_contents.availability", "in", UNAVAILABLE_FILTER);
}

function withPlatform<T extends {
  ilike: (column: string, value: string) => T;
  not: (column: string, operator: string, value: string) => T;
}>(query: T, platform?: SocialPlatform): T {
  if (platform === "youtube") {
    return query
      .ilike("meme_contents.platform", "youtube")
      .not("meme_contents.url", "ilike", "%/shorts/%");
  }
  if (platform === "youtube_shorts") {
    return query
      .ilike("meme_contents.platform", "youtube")
      .ilike("meme_contents.url", "%/shorts/%");
  }
  if (platform === "tiktok") return query.ilike("meme_contents.platform", "tiktok");
  if (platform === "instagram") return query.ilike("meme_contents.platform", "instagram");
  return query;
}

function buildQuery(supabase: SupabaseClient<Database>, filters: Filters) {
  // 검색어가 있으면 search_memes RPC 위에 동일 필터/정렬을 얹는다
  // (components/explore-grid.tsx의 buildMemesQuery와 반드시 동기화).
  if (filters.q) {
    let sq = supabase
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
    return sq;
  }

  let q = supabase
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
  return q;
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

  const [initialLoad, platformCounts] = await Promise.all([
    (async (): Promise<{ items: MemeListItem[]; unavailable: boolean }> => {
      const curated = filters.q ? curatedSearchCards(filters.q) : [];
      try {
        const supabase = createStaticClient();
        const { data, error } = await buildQuery(supabase, filters).range(
          0,
          PAGE_SIZE - 1
        );
        // 조회 실패를 빈 목록으로 두면 출처 개수만 남고 "아직 없어요"가 된다.
        if (error) {
          return curated.length > 0
            ? { items: curated, unavailable: false }
            : { items: [], unavailable: true };
        }
        const rows = (data ?? []) as unknown as MemeListItem[];
        const seen = new Set(rows.map((item) => item.short_id));
        return {
          items: [...curated.filter((item) => !seen.has(item.short_id)), ...rows],
          unavailable: false,
        };
      } catch {
        return curated.length > 0
          ? { items: curated, unavailable: false }
          : { items: [], unavailable: true };
      }
    })(),
    getSocialPlatformCounts(),
  ]);

  return (
    <main className="bg-background pb-14 text-foreground">
      <AdsenseScript />
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <ExploreCollectionJsonLd />
        <div className="hover-glow-flame rounded-2xl border border-border bg-surface px-4 py-5 md:px-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            Discover
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                밈 <span className="text-signal">탐색</span>
              </h1>
              <p className="mt-1 text-base text-muted">
                검색하고, 필요한 조건만 골라 바로 결과를 확인하세요.
              </p>
            </div>
            <Link
              href="/collections"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-muted transition-colors hover:text-accent"
            >
              테마별 모음 <span aria-hidden className="ml-1">→</span>
            </Link>
          </div>
        </div>

        <ExploreFilters platformCounts={platformCounts} />

        <section
          aria-label="밈 탐색 결과"
          className="instrument-grid mt-6 rounded-2xl border border-border/70 p-3"
        >
          <ExploreGrid
            key={filterKey(filters)}
            initial={initialLoad.items}
            catalogUnavailable={initialLoad.unavailable}
            filters={filters}
          />
        </section>
      </div>
    </main>
  );
}
