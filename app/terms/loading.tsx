import { SkeletonBone } from "@/components/skeletons";

/** 이용약관 로딩 — 제목 + 시행일 + 조항 다수 스켈레톤 */
export default function TermsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>

      <SkeletonBone className="h-8 w-32" />
      <SkeletonBone className="mt-2 h-4 w-32" />

      <div className="mt-8 space-y-8">
        {Array.from({ length: 6 }).map((_, section) => (
          <section key={section}>
            <SkeletonBone className="h-6 w-48" />
            <div className="mt-3 space-y-2.5">
              <SkeletonBone className="h-4 w-full" />
              <SkeletonBone className="h-4 w-full" />
              <SkeletonBone className="h-4 w-3/4" />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
