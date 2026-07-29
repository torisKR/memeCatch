import Link from "next/link";

/** 검색이라는 홈의 한 가지 임무에 집중한 편집형 히어로. */
export function HeroWeb3({ totalCount }: { totalCount: number }) {
  return (
    <section aria-label="밈 검색" className="border-b border-white/10 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl items-stretch lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <div className="flex flex-col justify-center px-4 py-12 sm:py-16 lg:py-20 lg:pr-14">
          <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-white/65">
            <span aria-hidden className="h-px w-8 bg-(--flame-400)" />
            Korean meme dictionary
          </p>
          <h1 className="mt-5 max-w-2xl text-[2.65rem] font-black leading-[1.06] tracking-[-0.035em] sm:text-[3.8rem]">
            그 밈, <span className="text-(--flame-400)">맥락까지</span>
            <br />
            3초 안에.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/68 sm:text-lg">
            뜻만 번역하지 않아요. 어디서 시작됐고, 언제 어떻게 써야 자연스러운지까지
            한 번에 확인하세요.
          </p>

          <form action="/search" role="search" className="mt-8 max-w-2xl">
            <label htmlFor="home-search" className="sr-only">
              밈 검색
            </label>
            <div className="grid gap-2 rounded-2xl bg-white p-2 shadow-[0_16px_50px_-22px_rgba(0,0,0,0.9)] sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  id="home-search"
                  name="q"
                  type="search"
                  placeholder="궁금한 밈·유행어를 검색해보세요"
                  autoComplete="off"
                  enterKeyHint="search"
                  className="h-12 w-full rounded-xl border-0 bg-transparent pl-11 pr-3 text-base text-neutral-950 outline-none placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                />
              </div>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none"
              >
                검색하기 <span aria-hidden>→</span>
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/58">
            {totalCount > 0 && (
              <span>
                <strong className="font-mono text-white">
                  {totalCount.toLocaleString("ko-KR")}
                </strong>개 밈의 뜻·유래 기록 중
              </span>
            )}
            <Link
              href="/explore"
              className="inline-flex min-h-11 items-center font-semibold text-white underline decoration-white/35 underline-offset-4 transition-colors hover:text-(--flame-300)"
            >
              전체 밈 둘러보기
            </Link>
          </div>
        </div>

        <div className="relative hidden min-h-[34rem] overflow-hidden border-l border-white/10 lg:block">
          <picture>
            <source srcSet="/brand/hero-meme-signal.avif" type="image/avif" />
            {/* 정적 브랜드 자산은 public 경로와 고정 크기를 사용한다. */}
            <img
              src="/brand/hero-meme-signal.webp"
              alt=""
              width={1600}
              height={893}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/15"
          />
          <div className="absolute inset-x-8 bottom-8 border-l-2 border-(--flame-400) pl-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Meaning / Origin / Timing
            </p>
            <p className="mt-1 max-w-sm text-lg font-bold leading-snug text-white">
              보이는 장면보다 중요한 건, 그 밈이 쓰이는 순간이에요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
