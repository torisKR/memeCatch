import { MemeCardSkeleton, SkeletonBone } from "@/components/skeletons";

/** 탐색 페이지 로딩 — 헤더 + 필터 바 + 카드 그리드 스켈레톤 */
export default function ExploreLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-8">
      <SkeletonBone className="h-3 w-20" />
      <SkeletonBone className="mt-2 h-9 w-36" />
      <SkeletonBone className="mt-2 h-5 w-2/3" />

      <div className="mt-6 border-y border-border py-4">
        <SkeletonBone className="h-12 w-full rounded-xl" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          <SkeletonBone className="h-10 w-28 shrink-0 rounded-lg" />
          <SkeletonBone className="h-10 w-32 shrink-0 rounded-lg" />
          <SkeletonBone className="h-10 w-20 shrink-0 rounded-full" />
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <MemeCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
