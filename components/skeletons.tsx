/** 스켈레톤 모음 — 모든 공개 화면 로딩 상태의 단일 소스 */

function Bone({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />
  );
}

export function MemeCardSkeleton() {
  return (
    <div className="min-w-0">
      <Bone className="aspect-[4/5] w-full rounded-xl" />
      <div className="mt-2 space-y-2">
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3.5 w-full" />
        <Bone className="h-6 w-20 rounded-full" />
      </div>
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

/** 밈 상세 — 정답 카드 스켈레톤 */
export function AnswerCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <Bone className="h-5 w-24 rounded-full" />
      <Bone className="h-8 w-2/3" />
      <Bone className="h-5 w-full" />
      <Bone className="h-14 w-full rounded-2xl" />
    </div>
  );
}

/** 밈 상세 전체 스켈레톤 */
export function MemeDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <AnswerCardSkeleton />
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-11 w-full" />
        ))}
      </div>
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
