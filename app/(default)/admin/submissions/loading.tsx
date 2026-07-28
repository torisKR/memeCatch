import { SkeletonBone } from "@/components/skeletons";

/** 제보 큐 로딩 — 헤더 + 제보 행 스켈레톤 */
export default function AdminSubmissionsLoading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
      <div>
        <SkeletonBone className="h-8 w-20" />
        <SkeletonBone className="mt-2 h-5 w-full max-w-lg" />
      </div>

      <ul className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-2">
                <SkeletonBone className="h-5 w-40" />
                <SkeletonBone className="h-4 w-56" />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <SkeletonBone className="h-4 w-16" />
                <SkeletonBone className="h-4 w-20" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
