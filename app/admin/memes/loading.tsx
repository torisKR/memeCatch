import { SkeletonBone } from "@/components/skeletons";

/** 밈 관리 목록 로딩 — 헤더 + 검색 폼 + 테이블 행 스켈레톤 */
export default function AdminMemesLoading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
      <SkeletonBone className="h-8 w-32" />

      <div className="flex flex-wrap items-end gap-3">
        <SkeletonBone className="h-[62px] w-full max-w-xs" />
        <SkeletonBone className="h-[62px] w-40" />
        <SkeletonBone className="h-11 w-20" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-3">
          <SkeletonBone className="h-5 w-full max-w-2xl" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <SkeletonBone className="h-5 w-40" />
              <SkeletonBone className="h-6 w-20 rounded-full" />
              <SkeletonBone className="h-6 w-16 rounded-full" />
              <SkeletonBone className="h-5 w-16" />
              <SkeletonBone className="h-5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
