import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { MemeListItem } from "@/lib/queries";
import {
  CATEGORIES,
  DIFFICULTY,
  LIFECYCLE_STATUS,
  type MemeCategory,
} from "@/lib/labels";
import { ExploreFilters } from "@/components/explore-filters";
import {
  ExploreGrid,
  type ExploreFilters as Filters,
  type SortKey,
} from "@/components/explore-grid";

/**
 * 레인 B 여정2 — 전체 탐색 페이지.
 * searchParams(필터/정렬)를 읽어 첫 페이지를 서버에서 조회하고,
 * <ExploreFilters>(URL 동기화) + <ExploreGrid>(무한 스크롤)를 렌더한다.
 * searchParams 사용 → 동적 렌더. 쿠키 미사용(createStaticClient).
 *
 * ⚠️ 아래 필터→쿼리 매핑은 components/explore-grid.tsx의 buildMemesQuery와
 *    반드시 동기화한다("use client" 경계라 런타임 공유 불가 → 의도적 복제).
 */

export const metadata: Metadata = {
  title: "밈 탐색",
  description:
    "카테고리·연도·난이도로 거르고 급상승·최신·인기·논쟁 순으로 전체 밈을 탐색해요.",
};

// components/explore-grid.tsx의 PAGE_SIZE와 동일하게 유지
const PAGE_SIZE = 24;
const SEARCH_LIMIT = 50; // components/explore-grid.tsx의 SEARCH_LIMIT과 동일
const SELECT = "*, meme_contents(thumbnail_url, is_representative)";
const YEAR_RANGES: Record<string, [number, number]> = {
  "2020s": [2020, 2029],
  "2010s": [2010, 2019],
  "2000s": [2000, 2009],
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as MemeCategory[];
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
  return {
    categories: asArray(sp.category).filter((c) =>
      (CATEGORY_KEYS as string[]).includes(c)
    ) as MemeCategory[],
    difficulty: one(sp.difficulty, DIFFICULTY_KEYS) as Filters["difficulty"],
    lifecycle: one(sp.lifecycle, LIFECYCLE_KEYS) as Filters["lifecycle"],
    media: one(sp.media, MEDIA_KEYS) as Filters["media"],
    year: one(sp.year, YEAR_KEYS),
    sort: (one(sp.sort, SORT_KEYS) ?? "trending") as SortKey,
    q: rawQ?.trim() || undefined,
  };
}

function buildQuery(supabase: SupabaseClient<Database>, filters: Filters) {
  // 검색어가 있으면 search_memes RPC 위에 동일 필터/정렬을 얹는다
  // (components/explore-grid.tsx의 buildMemesQuery와 반드시 동기화).
  if (filters.q) {
    let sq = supabase.rpc("search_memes", {
      p_query: filters.q,
      p_limit: SEARCH_LIMIT,
    });
    if (filters.categories.length > 0) sq = sq.in("category", filters.categories);
    if (filters.difficulty) sq = sq.eq("difficulty", filters.difficulty);
    if (filters.lifecycle) sq = sq.eq("lifecycle_status", filters.lifecycle);
    if (filters.media) sq = sq.eq("media_type", filters.media);
    if (filters.year && YEAR_RANGES[filters.year]) {
      const [lo, hi] = YEAR_RANGES[filters.year];
      sq = sq.gte("origin_year", lo).lte("origin_year", hi);
    }
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
    .select(SELECT)
    .in("moderation_status", ["approved", "limited"]);

  if (filters.categories.length > 0) q = q.in("category", filters.categories);
  if (filters.difficulty) q = q.eq("difficulty", filters.difficulty);
  if (filters.lifecycle) q = q.eq("lifecycle_status", filters.lifecycle);
  if (filters.media) q = q.eq("media_type", filters.media);
  if (filters.year && YEAR_RANGES[filters.year]) {
    const [lo, hi] = YEAR_RANGES[filters.year];
    q = q.gte("origin_year", lo).lte("origin_year", hi);
  }
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
    f.difficulty ?? "",
    f.lifecycle ?? "",
    f.media ?? "",
    f.year ?? "",
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

  let initial: MemeListItem[] = [];
  try {
    const supabase = createStaticClient();
    const { data } = await buildQuery(supabase, filters).range(0, PAGE_SIZE - 1);
    initial = (data ?? []) as MemeListItem[];
  } catch {
    initial = [];
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6">
      <h1 className="text-2xl font-bold">밈 탐색</h1>
      <p className="mt-1 text-base text-muted">
        지금 도는 밈을 카테고리·연도·난이도로 골라 봐요.
      </p>

      <ExploreFilters />

      <div className="mt-5">
        <ExploreGrid key={filterKey(filters)} initial={initial} filters={filters} />
      </div>
    </main>
  );
}
