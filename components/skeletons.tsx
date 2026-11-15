/** 스켈레톤 모음 — 모든 공개 화면 로딩 상태의 단일 소스 */

function Bone({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`shimmer instrument-grid rounded-lg ${className}`} />
  );
}

export function MemeCardSkeleton() {
  return (
    <div className="min-w-0">
      <Bone className="aspect-[4/3] w-full rounded-[16px]" />
    </div>
  );
}

/** 홈 가로 스트립 스켈레톤 */
export function MemeStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 shrink-0">
          <MemeCardSkeleton />
        </div>
      ))}
    </div>
  );
}

/** 2열 그리드 스켈레톤 (검색·관련 밈·홈 섹션 공용) */
export function MemeGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <MemeCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 밈 상세 — 정답 카드 스켈레톤.
 * 실제 AnswerCard 구성(헤더 행 → SignalTrace 계기판 → h1 → 한 줄 뜻 → 안전 신호등
 * 블록, 390px 기준 총 ~341px)과 블록 수·높이를 맞춘다 — 스켈레톤이 실제보다 짧으면
 * 교체 순간 아래 콘텐츠가 밀리는 CLS가 난다(LOOP.md §9, 루프 024 PERF-003).
 */
export function AnswerCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <Bone className="h-5 w-24 rounded-full" />
      {/* SignalTrace 파형 영역 — 기존 스켈레톤에 누락돼 있던 블록 */}
      <Bone className="h-16 w-full rounded-xl" />
      <Bone className="h-8 w-2/3" />
      <Bone className="h-12 w-full" />
      <Bone className="h-[4.5rem] w-full rounded-2xl" />
    </div>
  );
}

/** 밈 상세 전체 스켈레톤 — 실제 페이지 순서(정답 카드 → 대표 미디어 → 본문)와 일치 */
export function MemeDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <AnswerCardSkeleton />
      {/* 이전의 h-11×4 블록은 실제 화면에 대응물이 없어 제거(양방향 CLS 원인) */}
      <Bone className="aspect-video w-full rounded-xl" />
      <div className="space-y-2">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** 검색 결과 스켈레톤 */
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      <Bone className="h-4 w-32" />
      <MemeGridSkeleton count={6} />
    </div>
  );
}

export { Bone as SkeletonBone };
