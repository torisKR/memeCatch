import { MemeCardSkeleton } from "@/components/skeletons";

/** /timeline 로딩 스켈레톤 — 연도 라벨 + 카드 스트립 형태를 흉내낸다 */
export default function TimelineLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-14 pt-8" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-2/3 animate-pulse rounded-lg bg-surface-2" />
      </div>

      <div className="mt-8 space-y-10">
        {[0, 1].map((d) => (
          <div key={d}>
            <div className="h-7 w-32 animate-pulse rounded-lg bg-surface-2" />
            <div className="mt-5 space-y-6">
              {[0, 1, 2].map((y) => (
                <div key={y} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="h-6 w-12 shrink-0 animate-pulse rounded-lg bg-surface-2 sm:w-16" />
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:flex sm:gap-3">
                    {[0, 1, 2, 3].map((c) => (
                      <div key={c} className="min-w-0 sm:w-40 sm:shrink-0">
                        <MemeCardSkeleton />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">밈 연표를 불러오고 있어요</p>
    </main>
  );
}
