import { MemeCardSkeleton, SkeletonBone } from "@/components/skeletons";

/** 컬렉션 허브 로딩 — 브레드크럼 + 제목 + 인트로 + 카드 그리드 스켈레톤 */
export default function CollectionLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>

      {/* 브레드크럼 */}
      <SkeletonBone className="h-4 w-24" />

      {/* 제목 */}
      <SkeletonBone className="mt-2 h-8 w-56" />

      {/* 인트로 문단 */}
      <div className="mt-3 max-w-2xl space-y-2">
        <SkeletonBone className="h-4 w-full" />
        <SkeletonBone className="h-4 w-5/6" />
      </div>

      {/* 카드 그리드 */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <MemeCardSkeleton key={i} />
        ))}
      </div>

      {/* 전체 탐색 버튼 */}
      <div className="mt-8 flex flex-wrap gap-3">
        <SkeletonBone className="h-11 w-40 rounded-full" />
      </div>

      {/* 다른 모음 섹션 */}
      <div className="mt-12">
        <SkeletonBone className="h-6 w-32" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBone key={i} className="h-11 w-24 rounded-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
