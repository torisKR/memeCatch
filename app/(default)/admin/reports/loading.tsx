import { SkeletonBone } from "@/components/skeletons";

/** 신고 목록 로딩 — 헤더 + 신고 카드 스켈레톤 */
export default function AdminReportsLoading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
      <div>
        <SkeletonBone className="h-8 w-20" />
        <SkeletonBone className="mt-2 h-5 w-full max-w-lg" />
      </div>

      <ul className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <SkeletonBone className="h-5 w-14 rounded-full" />
              <SkeletonBone className="h-4 w-40" />
            </div>
            <SkeletonBone className="h-4 w-3/4" />
            <SkeletonBone className="h-16 w-full rounded-lg" />
            <SkeletonBone className="h-9 w-40" />
          </li>
        ))}
      </ul>
    </div>
  );
}
