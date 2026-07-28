import { MemeGridSkeleton, SkeletonBone } from "@/components/skeletons";

/** 주간 결산 로딩 — 헤딩 + 인트로 + 급상승/신규 그리드 + 카테고리 바 스켈레톤 */
export default function WeeklyLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy>
      <SkeletonBone className="h-4 w-24" />
      <SkeletonBone className="mt-3 h-9 w-72" />
      <SkeletonBone className="mt-3 h-5 w-full max-w-2xl" />
      <SkeletonBone className="mt-1 h-5 w-3/4 max-w-2xl" />

      <div className="mt-10">
        <SkeletonBone className="h-6 w-32" />
        <SkeletonBone className="mt-2 h-4 w-48" />
        <div className="mt-4">
          <MemeGridSkeleton count={5} />
        </div>
      </div>

      <div className="mt-10">
        <SkeletonBone className="h-6 w-32" />
        <SkeletonBone className="mt-2 h-4 w-48" />
        <div className="mt-4">
          <MemeGridSkeleton count={4} />
        </div>
      </div>

      <div className="mt-10">
        <SkeletonBone className="h-6 w-40" />
        <div className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBone key={i} className="h-8 w-full rounded-full" />
          ))}
        </div>
      </div>

      <p className="sr-only">주간 결산을 불러오고 있어요</p>
    </main>
  );
}
