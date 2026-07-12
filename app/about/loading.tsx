import { SkeletonBone } from "@/components/skeletons";

/** 소개 페이지 로딩 — 제목 + 인트로 문단 + 섹션 여러 개 스켈레톤 */
export default function AboutLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>

      <SkeletonBone className="h-8 w-48" />

      <div className="mt-3 space-y-2">
        <SkeletonBone className="h-5 w-full" />
        <SkeletonBone className="h-5 w-full" />
        <SkeletonBone className="h-5 w-2/3" />
      </div>

      {Array.from({ length: 5 }).map((_, section) => (
        <section key={section} className="mt-10">
          <SkeletonBone className="h-6 w-40" />
          <div className="mt-3 space-y-2.5">
            <SkeletonBone className="h-4 w-full" />
            <SkeletonBone className="h-4 w-full" />
            <SkeletonBone className="h-4 w-5/6" />
          </div>
        </section>
      ))}
    </main>
  );
}
