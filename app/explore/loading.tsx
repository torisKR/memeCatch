import { MemeCardSkeleton, SkeletonBone } from "@/components/skeletons";

/** 탐색 페이지 로딩 — 헤더 + 필터 바 + 카드 그리드 스켈레톤 */
export default function ExploreLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6">
      <SkeletonBone className="h-8 w-32" />
      <SkeletonBone className="mt-2 h-5 w-2/3" />

      {/* 정렬 + 카테고리 칩 바 */}
      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBone key={i} className="h-9 w-16 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-3 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBone key={i} className="h-9 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* 카드 그리드 */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <MemeCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
