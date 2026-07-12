import { SkeletonBone } from "@/components/skeletons";

/** 제보 상세 로딩 — 헤더 + 메타 필드 + 첨부 이미지 자리 + 액션 버튼 스켈레톤 */
export default function AdminSubmissionDetailLoading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
      <div>
        <SkeletonBone className="h-5 w-20" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SkeletonBone className="h-8 w-48" />
          <SkeletonBone className="h-5 w-16" />
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <SkeletonBone className="h-6 w-24" />
        <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBone className="h-4 w-16" />
              <SkeletonBone className="h-4 w-32" />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <SkeletonBone className="h-4 w-16" />
            <SkeletonBone className="h-4 w-full" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <SkeletonBone className="h-4 w-16" />
            <SkeletonBone className="h-16 w-full" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <SkeletonBone className="h-4 w-20" />
            <SkeletonBone className="h-52 w-72 rounded-xl" />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <SkeletonBone className="h-11 w-28" />
        <SkeletonBone className="h-11 w-28" />
        <SkeletonBone className="h-11 w-28" />
      </div>
    </div>
  );
}
