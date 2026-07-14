"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { MemeCardSkeleton } from "@/components/skeletons";
import type { MemeCategory } from "@/lib/labels";
import type { SocialPlatform } from "@/lib/source-platform";

/**
 * 레인 B 여정2 — 전체 탐색 그리드 (무한 스크롤).
 * 서버가 첫 페이지(initial)와 현재 필터(filters)를 넘겨준다.
 * 바닥 근처 진입(IntersectionObserver) 시 같은 필터·정렬로 다음 페이지를 range 조회.
 * MemeCard 재사용. 무한 스크롤에서 동적으로 추가되는 카드는 즉시 표시한다.
 * 빈/끝/에러 상태 포함.
 *
 * ⚠️ 이 파일은 "use client" 경계라 런타임 export를 서버에서 호출할 수 없다.
 *    필터→쿼리 매핑 로직은 app/explore/page.tsx(서버)에도 동일하게 복제되어 있으며,
 *    아래 buildMemesQuery / PAGE_SIZE / SELECT 와 반드시 동기화한다.
 */

export type SortKey = "trending" | "recent" | "popular" | "controversial";

/** URL 쿼리 → 정규화된 탐색 필터 (enum 타입으로 좁혀 eq/in 타입 안전) */
export type ExploreFilters = {
  categories: MemeCategory[];
  difficulty?: Database["public"]["Enums"]["meme_difficulty"];
  lifecycle?: Database["public"]["Enums"]["lifecycle_status"];
  media?: Database["public"]["Enums"]["media_type"];
  year?: string; // '2020s' | '2010s' | '2000s'
  platform?: SocialPlatform;
  sort: SortKey;
  q?: string; // 이 목록 안 검색어 — 있으면 search_memes RPC 경로
};

/** 검색 RPC 상한(SQL의 least(p_limit,50)) — 검색 결과 페이지네이션의 실질 상한 */
const SEARCH_LIMIT = 50;

/** 한 페이지 크기 — app/explore/page.tsx의 첫 페이지 크기와 반드시 동일하게 유지 */
export const PAGE_SIZE = 24;

export const EXPLORE_SELECT =
  "*, meme_contents(thumbnail_url, is_representative, platform, url), meme_sources(platform, source_url)";

function exploreSelect(platform?: SocialPlatform) {
  const contents = platform
    ? "meme_contents!inner(thumbnail_url, is_representative, platform, url)"
    : "meme_contents(thumbnail_url, is_representative, platform, url)";
  return `*, ${contents}, meme_sources(platform, source_url)`;
}

function withPublicContent<T extends {
  eq: (column: string, value: string) => T;
  neq: (column: string, value: string) => T;
}>(query: T): T {
  return query
    .eq("meme_contents.moderation_status", "approved")
    .neq("meme_contents.availability", "dead");
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

export const YEAR_RANGES: Record<string, [number, number]> = {
  "2020s": [2020, 2029],
  "2010s": [2010, 2019],
  "2000s": [2000, 2009],
};

/**
 * 필터·정렬을 PostgREST 쿼리에 적용 (range는 호출부에서 붙인다).
 * 서버(createStaticClient)와 브라우저(createClient) 양쪽 SupabaseClient<Database>에서 동일 동작.
 */
export function buildMemesQuery(
  supabase: SupabaseClient<Database>,
  filters: ExploreFilters
) {
  // 검색어가 있으면 search_memes RPC(trgm·초성·별칭 서버 처리) 결과 위에
  // 동일한 카테고리/정렬/페이지네이션을 얹는다. RPC는 setof memes라 필터 체이닝 가능.
  // (RPC 내부 LIMIT 50 → 검색 결과는 최대 50건까지 무한스크롤)
  if (filters.q) {
    let sq = supabase
      .rpc("search_memes", {
        p_query: filters.q,
        p_limit: SEARCH_LIMIT,
      })
      .select(exploreSelect(filters.platform));
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
    .select(exploreSelect(filters.platform))
    .in("moderation_status", ["approved", "limited"]);
  if (filters.platform) q = withPublicContent(q);

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

  // 정렬 매핑: trending/popular→trend_score desc, recent/controversial→published_at desc
  if (filters.sort === "recent" || filters.sort === "controversial") {
    q = q.order("published_at", { ascending: false, nullsFirst: false });
  } else {
    q = q.order("trend_score", { ascending: false });
  }
  // 페이지네이션 안정용 2차 정렬(동점 시 순서 고정)
  q = q.order("id", { ascending: false });

  return q;
}

async function fetchPage(
  supabase: SupabaseClient<Database>,
  filters: ExploreFilters,
  page: number
): Promise<MemeListItem[]> {
  const from = page * PAGE_SIZE;
  const { data, error } = await buildMemesQuery(supabase, filters).range(
    from,
    from + PAGE_SIZE - 1
  );
  if (error || !data) throw error ?? new Error("no data");
  return data as unknown as MemeListItem[];
}

export function ExploreGrid({
  initial,
  filters,
  excludeIds = [],
}: {
  initial: MemeListItem[];
  filters: ExploreFilters;
  /** 스트림에서 항상 제외할 밈 id (예: 현재 보고 있는 밈) */
  excludeIds?: string[];
}) {
  const [items, setItems] = useState<MemeListItem[]>(initial);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // IntersectionObserver 콜백은 effect가 다시 만들어지기 전까지 이전
  // 렌더의 값을 잡고 있을 수 있다. 요청 가드는 ref로 유지해 빠른 재교차,
  // 모바일 브라우저의 연속 콜백에서도 같은 페이지를 중복 요청하지 않는다.
  const loadingRef = useRef(false);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(initial.length >= PAGE_SIZE);

  // 이미 담은 id — 중복 방지 (excludeIds는 시작부터 제외 처리)
  const seenRef = useRef<Set<string>>(
    new Set([...excludeIds, ...initial.map((m) => m.id)])
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    const next = pageRef.current + 1;
    try {
      const supabase = createClient();
      const batch = await fetchPage(supabase, filters, next);
      const fresh = batch.filter((m) => !seenRef.current.has(m.id));
      for (const m of fresh) seenRef.current.add(m.id);
      setItems((prev) => [...prev, ...fresh]);
      pageRef.current = next;
      const nextHasMore = batch.length >= PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMoreRef.current) return;

    const nearBottom = () => {
      const rect = el.getBoundingClientRect();
      return rect.top <= window.innerHeight + 600;
    };

    // IntersectionObserver가 없는 환경(일부 인앱 브라우저/WebView)에서도
    // 같은 로딩 경계를 유지하도록 passive scroll 폴백을 제공한다.
    const supportsIntersectionObserver =
      typeof window.IntersectionObserver === "function";
    if (!supportsIntersectionObserver) {
      const onScroll = () => {
        if (nearBottom()) void loadMore();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener("scroll", onScroll);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore, items.length]);

  // 빈 상태 — 이 조건에 맞는 밈이 하나도 없음 (검색어가 있으면 반영)
  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-xl font-bold">
          {filters.q ? (
            <>
              &lsquo;<span className="text-accent">{filters.q}</span>&rsquo; 검색
              결과가 없어요
            </>
          ) : (
            "이 조건의 밈이 아직 없어요"
          )}
        </p>
        <p className="mt-1.5 text-base text-muted">
          {filters.q
            ? "다른 말로 검색하거나 필터를 풀어 보세요. 아직 없는 밈이면 제보해 주세요."
            : "필터를 풀어 보거나, 알고 있는 밈을 제보해 주세요."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/explore"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
          >
            필터 초기화
          </Link>
          <Link
            href="/submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-bold text-white active:scale-[0.97]"
          >
            밈 제보하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
        {items.map((meme) => (
          <li key={meme.id} className="min-w-0">
            <MemeCard meme={meme} />
          </li>
        ))}
      </ul>

      {/* 로딩 스켈레톤 — 다음 페이지 조회 중 */}
      {loading && (
        <ul
          className="mt-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4"
          aria-hidden
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="min-w-0">
              <MemeCardSkeleton />
            </li>
          ))}
        </ul>
      )}

      {/* 무한 스크롤 센티넬 */}
      {hasMore && !failed && <div ref={sentinelRef} className="h-1 w-full" />}

      {/* 조회 실패 — 재시도 */}
      {failed && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-border bg-surface-2 p-6 text-center"
        >
          <p className="text-base font-semibold">더 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={loadMore}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 끝 도달 */}
      {!hasMore && !loading && !failed && (
        <p className="mt-8 text-center text-sm text-muted" aria-live="polite">
          끝까지 봤어요
        </p>
      )}
    </div>
  );
}
