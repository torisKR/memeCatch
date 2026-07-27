"use client";

import { track } from "@/lib/analytics";

/**
 * 클릭 추적 래퍼 — 서버 컴포넌트 트리 안의 카드 그리드/스트립을 감싸
 * 내부 링크 클릭 시 GA4 이벤트 1회 발사(onClickCapture, 버블 전 캡처).
 * 이벤트 파라미터로 링크 href를 담아 어떤 밈으로 이동했는지 추적.
 */
export function TrackedBlock({
  event,
  params,
  children,
  className,
}: {
  event: Parameters<typeof track>[0];
  /** 이벤트에 함께 실을 추가 파라미터(예: 검색어). `to`는 항상 링크 href로 덮인다. */
  params?: Record<string, string | number>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a) track(event, { ...params, to: a.getAttribute("href") ?? "" });
      }}
    >
      {children}
    </div>
  );
}
