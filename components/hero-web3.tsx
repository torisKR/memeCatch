import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { LiveCaretInput } from "@/components/ui/live-caret-input";

const EXAMPLE_SEARCHES = ["꼬셔야겠어 챌린지", "브금", "잘자 내꿈꿔"] as const;

export function HeroWeb3({ totalCount }: { totalCount: number }) {
  return (
    <>
      <section aria-labelledby="home-hero-title" className="bg-background text-foreground">
        <div className="mx-auto grid max-w-6xl gap-7 px-4 py-8 sm:gap-9 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-center lg:gap-12 lg:py-14">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-wide text-accent-text">
              뜻 · 유래 · 사용 맥락
            </p>
            <h1 id="home-hero-title" className="mt-3 max-w-xl text-[clamp(2.25rem,5vw,3.75rem)] font-black leading-[1.08] tracking-[-0.045em]">
              밈의 뜻부터,
              <span className="block text-accent-text">지금 쓸 맥락까지.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              유행어와 밈의 뜻, 유래, 지금 사용해도 좋을지 확인해 보세요.
            </p>

            <form action="/search" role="search" className="mt-6 max-w-2xl">
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

          <figure className="relative hidden aspect-[2752/1536] overflow-hidden rounded-3xl border border-border bg-ink shadow-xl lg:block">
            <picture className="absolute inset-0 block size-full">
              <source
                media="(min-width: 1024px)"
                type="image/avif"
                srcSet="/brand/hero-signal-v2.avif"
              />
              <source
                media="(min-width: 1024px)"
                type="image/webp"
                srcSet="/brand/hero-signal-v2.webp"
              />
              <img
                src="/brand/hero-signal-v2.webp"
                alt=""
                width={2752}
                height={1536}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </picture>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-transparent" />
            <figcaption className="absolute bottom-4 left-5 max-w-[80%] text-sm font-semibold text-white sm:bottom-6 sm:left-7 sm:text-base">
              밈의 신호를 포착하고, 맥락을 함께 기록합니다.
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-label="밈 발견 바로가기" className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 font-semibold text-muted">바로 찾아보기</span>
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
