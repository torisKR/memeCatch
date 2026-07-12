import { SkeletonBone } from "@/components/skeletons";

/** 밈 편집 페이지 로딩 — 헤더 + 상태 컨트롤 + 편집 폼 필드 스켈레톤 */
export default function AdminMemeEditLoading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
      <div>
        <SkeletonBone className="h-5 w-24" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <SkeletonBone className="h-8 w-48" />
          <SkeletonBone className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <SkeletonBone className="h-11 w-full max-w-md" />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBone className="h-4 w-24" />
            <SkeletonBone className="h-11 w-full" />
          </div>
        ))}
        <SkeletonBone className="h-11 w-32" />
      </div>
    </div>
  );
}
