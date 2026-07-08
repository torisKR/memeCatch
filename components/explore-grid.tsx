"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { MemeCardSkeleton } from "@/components/skeletons";
import type { MemeCategory } from "@/lib/labels";

/**
 * 레인 B 여정2 — 전체 탐색 그리드 (무한 스크롤).
 * 서버가 첫 페이지(initial)와 현재 필터(filters)를 넘겨준다.
 * 바닥 근처 진입(IntersectionObserver) 시 같은 필터·정렬로 다음 페이지를 range 조회.
 * MemeCard 재사용 + MotionList 스태거. 빈/끝/에러 상태 포함.
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
  sort: SortKey;
};

/** 한 페이지 크기 — app/explore/page.tsx의 첫 페이지 크기와 반드시 동일하게 유지 */
export const PAGE_SIZE = 24;

export const EXPLORE_SELECT =
  "*, meme_contents(thumbnail_url, is_representative)";

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
  let q = supabase
    .from("memes")
    .select(EXPLORE_SELECT)
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
  return data as MemeListItem[];
}

export function ExploreGrid({
  initial,
  filters,
}: {
  initial: MemeListItem[];
  filters: ExploreFilters;
}) {
  const [items, setItems] = useState<MemeListItem[]>(initial);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // 이미 담은 id — 중복 방지
  const seenRef = useRef<Set<string>>(new Set(initial.map((m) => m.id)));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    const next = page + 1;
    try {
      const supabase = createClient();
      const batch = await fetchPage(supabase, filters, next);
      const fresh = batch.filter((m) => !seenRef.current.has(m.id));
      for (const m of fresh) seenRef.current.add(m.id);
      setItems((prev) => [...prev, ...fresh]);
      setPage(next);
      setHasMore(batch.length >= PAGE_SIZE);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, filters]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  // 빈 상태 — 이 조건에 맞는 밈이 하나도 없음
  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-xl font-bold">이 조건의 밈이 아직 없어요</p>
        <p className="mt-1.5 text-base text-muted">
          필터를 풀어 보거나, 알고 있는 밈을 제보해 주세요.
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
      <MotionList
        as="ul"
        itemAs="li"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
        itemClassName="min-w-0"
      >
        {items.map((meme) => (
          <MemeCard key={meme.id} meme={meme} />
        ))}
      </MotionList>

      {/* 로딩 스켈레톤 — 다음 페이지 조회 중 */}
      {loading && (
        <ul
          className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3"
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
