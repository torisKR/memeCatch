"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { MemeCardSkeleton } from "@/components/skeletons";
import { UNAVAILABLE_FILTER } from "@/lib/content-availability";
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
  topicTag?: string;
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

/**
 * 목록 카드가 읽는 memes 컬럼만 — lib/queries.ts의 LIST_COLUMN_LIST와 반드시 동기화.
 * ("use client" 경계라 lib/queries.ts를 값으로 import하면 서버 전용 모듈이 딸려온다 → 의도적 복제)
 */
const MEME_LIST_COLUMNS =
  "id, short_id, slug, title, summary, category, safety_level, lifecycle_status, media_type, origin_year, trend_score";

export const EXPLORE_SELECT = `${MEME_LIST_COLUMNS}, meme_contents(thumbnail_url, is_representative, platform, url), meme_sources(platform, source_url), meme_market_profiles(market_code, role, review_state)`;

function exploreSelect(platform?: SocialPlatform, topicTag?: string) {
  const contents = platform
    ? "meme_contents!inner(thumbnail_url, is_representative, platform, url)"
    : "meme_contents(thumbnail_url, is_representative, platform, url)";
  const topic = topicTag ? ", meme_tags_map!inner(tags!inner(name))" : "";
  return `${MEME_LIST_COLUMNS}, ${contents}, meme_sources(platform, source_url), meme_market_profiles(market_code, role, review_state)${topic}`;
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
  filters: ExploreFilters,
  options?: { countOnly?: boolean }
) {
  // 검색어가 있으면 search_memes RPC(trgm·초성·별칭 서버 처리) 결과 위에
  // 동일한 카테고리/정렬/페이지네이션을 얹는다. RPC는 setof memes라 필터 체이닝 가능.
  // (RPC 내부 LIMIT 50 → 검색 결과는 최대 50건까지 무한스크롤)
  if (filters.q) {
    let sq = supabase
      .rpc(filters.topicTag ? "search_ai_memes" : "search_memes", {
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
    // countOnly면 행 없이 총계만 받는다(head) — §6 「결과 수 제공」용.
    // select 문자열은 동일하게 유지해야 platform의 !inner 임베드 필터가 살아 있다.
    .select(
      exploreSelect(filters.platform, filters.topicTag),
      options?.countOnly ? { count: "exact", head: true } : undefined,
    )
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

/** 지정한 오프셋부터 PAGE_SIZE만큼 — 서버가 소비한 행 수에서 이어받기 위해 오프셋 기준. */
async function fetchFrom(
  supabase: SupabaseClient<Database>,
  filters: ExploreFilters,
  from: number
): Promise<MemeListItem[]> {
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
  initialOffset,
  hasMoreInitial,
}: {
  initial: MemeListItem[];
  filters: ExploreFilters;
  /** 스트림에서 항상 제외할 밈 id (예: 현재 보고 있는 밈) */
  excludeIds?: string[];
  /**
   * 서버가 이미 소비한 행 수 — 다음 페이지는 여기서 이어받는다.
   * 기본값은 initial.length(서버가 보여 준 만큼만 소비한 일반적인 경우).
   * 서버가 조회한 것보다 적게 렌더한 경우(예: 상세의 '이어서 볼 만한 밈'은
   * 링크 수를 줄이려 앞부분만 보여 준다) 실제 소비 행 수를 넘겨야 목록이 건너뛰지 않는다.
   */
  initialOffset?: number;
  /**
   * 첫 화면 뒤로 더 있는지 — 기본값은 "첫 묶음이 꽉 찼으면 더 있다"는 추정.
   * 서버가 의도적으로 적게 렌더한 경우 추정이 빗나가므로 명시할 수 있게 열어 둔다.
   */
  hasMoreInitial?: boolean;
}) {
  const startHasMore = hasMoreInitial ?? initial.length >= PAGE_SIZE;
  const [items, setItems] = useState<MemeListItem[]>(initial);
  const [hasMore, setHasMore] = useState(startHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // 결과 총계 (§6) — head 전용 카운트 쿼리로 채운다. 실패해도 목록엔 영향 없음.
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    // 검색 경로는 RPC 50건 캡이라 정확한 총계 불가 — 렌더 가드가 표시를 막는다
    // (effect 안 동기 setState 금지 — 캐스케이드 렌더 방지 lint 준수).
    if (filters.q) return;
    let cancelled = false;
    (async () => {
      try {
        const { count } = await buildMemesQuery(createClient(), filters, {
          countOnly: true,
        });
        if (!cancelled && typeof count === "number") setTotal(count);
      } catch (err) {
        // 총계는 부가 정보 — 실패해도 목록은 정상. 단 조용히 삼키면 회귀를 못 보므로
        // 로그는 남긴다(silent-failure 금지).
        console.error("explore 결과 수 조회 실패:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters는 URL 파생 불변 객체
  }, [filters.q, filters.platform, filters.topicTag, filters.categories.join(","), filters.difficulty, filters.lifecycle, filters.media, filters.year, filters.sort]);

  // IntersectionObserver 콜백은 effect가 다시 만들어지기 전까지 이전
  // 렌더의 값을 잡고 있을 수 있다. 요청 가드는 ref로 유지해 빠른 재교차,
  // 모바일 브라우저의 연속 콜백에서도 같은 페이지를 중복 요청하지 않는다.
  const loadingRef = useRef(false);
  const offsetRef = useRef(initialOffset ?? initial.length);
  const hasMoreRef = useRef(startHasMore);

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
    const from = offsetRef.current;
    try {
      const supabase = createClient();
      const batch = await fetchFrom(supabase, filters, from);
      const fresh = batch.filter((m) => !seenRef.current.has(m.id));
      for (const m of fresh) seenRef.current.add(m.id);
      setItems((prev) => [...prev, ...fresh]);
      // 중복 제거 전 조회한 행 수만큼 전진 — 걸러진 행을 다시 읽지 않는다.
      offsetRef.current = from + batch.length;
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
      <div className="glass-panel relative mt-8 overflow-hidden rounded-2xl p-8 text-center">
        {/* 계측 격자 — 정적 장식 레이어. glass-panel의 background shorthand와 같은 요소에
            함께 두면 background-image가 덮여 사라지므로 별도 절대배치 레이어로 분리
            (components/hero-web3.tsx와 동일 패턴). */}
        <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
        <div className="relative">
          {/* 브랜드 빈 상태 일러스트 — 잉크 배경 원본을 screen 블렌드로 표면에 융화 */}
          <img
            src="/brand/state-empty-search.webp"
            alt=""
            width={1024}
            height={768}
            loading="lazy"
            decoding="async"
            className="mx-auto mb-2 w-48 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-56"
          />
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
              rel="nofollow"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-6 text-base font-bold text-white active:scale-[0.97]"
            >
              밈 제보하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 결과 수 (§6) — head 카운트가 도착한 뒤에만 렌더. 검색(q) 경로는 RPC가
          50건 캡이라 정확한 총계를 줄 수 없어 표시하지 않는다(부정확한 수 금지). */}
      {total != null && !filters.q && (
        <p aria-live="polite" className="mb-3 text-sm text-muted">
          결과 <strong className="font-semibold text-foreground">{total.toLocaleString("ko-KR")}</strong>개
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
        {items.map((meme) => (
          <li key={meme.id} className="min-w-0">
            <MemeCard meme={meme} sourcePlatform={filters.platform} />
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
          className="glass-panel relative mt-6 overflow-hidden rounded-2xl p-6 text-center"
        >
          <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
          <div className="relative">
            <p className="text-base font-semibold">더 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={loadMore}
              className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 끝 도달 */}
      {!hasMore && !loading && !failed && (
        <p
          className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-muted"
          aria-live="polite"
        >
          <span aria-hidden className="signal-live size-1.5 rounded-full bg-(--signal-cyan)" />
          끝까지 봤어요
        </p>
      )}
    </div>
  );
}
