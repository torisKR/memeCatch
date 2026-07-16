import { SkeletonBone } from "@/components/skeletons";

/** /quiz 로딩 스켈레톤 — 인트로 + 시작 카드(모드 3버튼)를 흉내낸다 */
export default function QuizLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy>
      <SkeletonBone className="h-4 w-16" />
      <SkeletonBone className="mt-2 h-8 w-64" />
      <div className="mt-3 space-y-2">
        <SkeletonBone className="h-4 w-full max-w-2xl" />
        <SkeletonBone className="h-4 w-2/3 max-w-2xl" />
      </div>

      {/* 시작 카드 */}
      <div className="mt-6 rounded-3xl border border-border bg-surface p-5 sm:p-8">
        <SkeletonBone className="h-4 w-28" />
        <SkeletonBone className="mt-2 h-7 w-48" />
        <SkeletonBone className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBone key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      <p className="sr-only">밈력고사를 불러오고 있어요</p>
    </main>
  );
}
