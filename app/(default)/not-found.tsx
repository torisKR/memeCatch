import Link from "next/link";

/**
 * 브랜드 404 — 존재하지 않는 주소/밈. StatusPanel의 신호등 언어를 그대로 잇되
 * 큰 404 숫자 + 검색 폼으로 "다시 잡으러 가는" 다음 행동을 제시한다.
 * 서버 컴포넌트(모션 불필요) · 이모지 금지(SVG만) · rounded/border/surface 토큰 준수.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <div
          className="relative overflow-hidden rounded-3xl border border-border bg-surface-2 px-6 py-10 text-center sm:px-10 sm:py-12"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 52%)",
          }}
        >
          <div className="relative mx-auto max-w-md">
            {/* 브랜드 404 일러스트 — 신호가 꺼진 말풍선. screen 블렌드로 표면 융화 */}
            <img
              src="/brand/state-404.webp"
              alt=""
              width={1024}
              height={768}
              loading="lazy"
              decoding="async"
              className="mx-auto mb-4 w-52 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-60"
            />
            <p className="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white">
              <span aria-hidden className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
              </span>
              신호 없음 · 404
            </p>

            <p
              aria-hidden
              className="mt-6 text-7xl font-extrabold leading-none tracking-tighter sm:text-8xl"
            >
              4<span className="text-accent-text">0</span>4
            </p>

            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
              이 밈은... 아직 없네요
            </h1>
            <p className="mt-2 text-base text-muted">
              주소가 바뀌었거나, 아직 사전에 안 잡힌 밈일 수 있어요.
              <br className="hidden sm:block" /> 검색으로 다시 잡아 볼까요?
            </p>

            <form action="/search" role="search" className="mt-6">
              <div className="flex gap-2">
                <label htmlFor="nf-q" className="sr-only">
                  밈 검색
                </label>
                <input
                  id="nf-q"
                  type="search"
                  name="q"
                  placeholder="어떤 밈을 찾고 있었나요?"
                  className="h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted focus:border-accent"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.6-3.6" />
                  </svg>
                  검색
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                홈으로
              </Link>
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                밈 탐색하기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
