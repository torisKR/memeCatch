import { SkeletonBone } from "@/components/skeletons";

/** /slang 로딩 스켈레톤 — 인트로 + 연대 탭 + 사전형 리스트 행을 흉내낸다 */
export default function SlangLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy>
      <SkeletonBone className="h-8 w-56" />
      <div className="mt-3 space-y-2">
        <SkeletonBone className="h-4 w-full max-w-2xl" />
        <SkeletonBone className="h-4 w-5/6 max-w-2xl" />
        <SkeletonBone className="h-4 w-2/3 max-w-2xl" />
      </div>
      <SkeletonBone className="mt-4 h-11 w-64 rounded-2xl" />

      {/* 연대 탭 */}
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBone key={i} className="h-11 w-24 rounded-full" />
        ))}
      </div>

      {/* 사전형 리스트 행 — 모바일 1열, lg 2열 */}
      <div className="mt-8 grid grid-cols-1 gap-x-10 lg:grid-cols-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-b border-border py-2.5">
            <div className="flex items-center gap-2">
              <SkeletonBone className="h-5 w-32" />
              <SkeletonBone className="h-5 w-12 rounded-full" />
              <SkeletonBone className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonBone className="mt-1.5 h-4 w-4/5" />
          </div>
        ))}
      </div>
      <p className="sr-only">줄임말·유행어 사전을 불러오고 있어요</p>
    </main>
  );
}
