"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * 검색 결과 계측 — /search 결과가 실제로 렌더된 시점에 1회 발사.
 *
 * 왜 입력창이 아니라 결과 쪽에서 재는가:
 * search-input.tsx는 300ms 디바운스로 `?q=`를 갱신한다. 즉 명시적 "제출"이
 * 없고, 입력창에서 재면 타이핑 중간 상태("ㅈ" → "졌" → "졌잘")마다 이벤트가
 * 발사돼 검색 수가 부풀려진다. 결과 쪽에서 재면 서버가 실제로 결과를 만들어
 * 보여준 순간만 세고, 결과 건수(result_count)도 함께 담을 수 있다.
 *
 * 그래도 URL은 중간 상태로도 갱신되므로 안정화 지연을 한 번 더 둔다.
 * 사용자가 결과를 실제로 본 쿼리만 남기기 위한 장치다.
 */

/**
 * 입력 디바운스(300ms) 위에 얹는 추가 대기.
 * 합계 약 1.2초 — 이보다 짧게 스쳐 간 중간 쿼리는 "검색했다"고 보지 않는다.
 */
const SETTLE_MS = 900;

/** GA4 파라미터 상한. 검색어는 사용자 입력이므로 반드시 잘라서 보낸다. */
const MAX_QUERY_LENGTH = 100;

export function SearchOutcomeTracker({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number;
}) {
  // 같은 쿼리로 중복 발사하지 않기 위한 기억.
  // 뒤로가기·재렌더로 같은 결과가 다시 그려져도 검색 1회로 센다.
  const lastFired = useRef<string | null>(null);

  useEffect(() => {
    if (!query) return;

    const timer = window.setTimeout(() => {
      if (lastFired.current === query) return;
      lastFired.current = query;

      const q = query.slice(0, MAX_QUERY_LENGTH);
      track("search_submit", { query: q, result_count: resultCount });

      // 실패 케이스를 별도 이벤트로도 남긴다.
      // search_submit의 result_count로도 계산할 수 있지만, 탐색 보고서에서
      // 바로 집계·알림을 걸 수 있어야 개선 루프가 짧아진다.
      if (resultCount === 0) track("search_no_result", { query: q });
    }, SETTLE_MS);

    // 쿼리가 또 바뀌면 이전 타이머는 취소된다 → 중간 상태는 발사되지 않는다.
    return () => window.clearTimeout(timer);
  }, [query, resultCount]);

  return null;
}
