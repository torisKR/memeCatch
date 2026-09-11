import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { CatchMascot } from "@/components/catch-mascot";
import { LiveCaretInput } from "@/components/ui/live-caret-input";

const EXAMPLE_SEARCHES = ["꼬셔야겠어 챌린지", "브금", "잘자 내꿈꿔"] as const;

export function HeroWeb3({ totalCount }: { totalCount: number }) {
  return (
    <>
      <section aria-label="밈 검색" className="bg-background text-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:gap-14 lg:py-20">
          <div>
            <p className="text-sm font-bold text-accent-text">
              한국부터 해외까지, 밈의 뜻과 유래
            </p>
            <h1 className="mt-4 max-w-2xl text-[clamp(2.5rem,5.4vw,4.75rem)] font-black leading-[1.05] tracking-[-0.045em]">
              <span className="block">오늘 본 그 밈,</span>
              <span className="block text-accent-text">맥락까지 한눈에.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              지금 써도 될지까지, 뜻·유래·현재 안전성은 무료로 확인하세요.
              무료 활용 문구 1개로 3분 안에 게시 준비를 시작하세요.
            </p>

            <form action="/search" role="search" className="mt-8 max-w-2xl">
              <label htmlFor="home-search" className="sr-only">
                밈 검색
              </label>
              <div className="grid gap-2 rounded-2xl border border-border bg-surface p-2 shadow-md sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-5 -translate-y-1/2 text-muted"
                  />
                  <LiveCaretInput
                    id="home-search"
                    name="q"
                    type="search"
                    placeholder="궁금한 밈·유행어를 검색해보세요"
                    autoComplete="off"
                    enterKeyHint="search"
                    color="var(--accent)"
                    caretWidth={2}
                    className="h-12 w-full rounded-xl bg-surface-2 focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent"
                    fieldClassName="pl-11 pr-3 text-base leading-[3rem] text-foreground placeholder:text-muted"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none"
                >
                  검색하기 <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </form>
          </div>

          <div className="relative grid aspect-[3/2] max-h-72 place-items-center overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm sm:max-h-80 lg:max-h-[34rem]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,var(--accent-soft),transparent_52%)]" />
            <CatchMascot size="lg" state="discovering" />
            <p className="absolute bottom-4 left-4 rounded-xl bg-surface/85 px-3 py-2 text-xs font-bold text-accent-text backdrop-blur-sm">
              캐치가 신호를 찾고 있어요
            </p>
          </div>
        </div>
      </section>

      <section aria-label="밈 발견 바로가기" className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 font-semibold text-muted">예시:</span>
            {EXAMPLE_SEARCHES.map((query) => (
              <Link
                key={query}
                href={`/search?q=${encodeURIComponent(query)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-3 font-medium text-foreground transition-colors duration-200 hover:border-accent hover:text-accent-text motion-reduce:transition-none"
              >
                {query}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
            {totalCount > 0 && (
              <span>
                <strong className="text-foreground">{totalCount.toLocaleString("ko-KR")}</strong>개
                밈의 뜻·유래 기록 중
              </span>
            )}
            <Link
              href="/explore"
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent-text transition-colors duration-200 hover:text-accent motion-reduce:transition-none"
            >
              전체 밈 둘러보기 <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
