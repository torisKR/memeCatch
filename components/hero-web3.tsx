import Link from "next/link";
import { SignalTrace } from "@/components/signal-trace";
import { LiveCaretInput } from "@/components/ui/live-caret-input";
import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/lib/labels";

/** 판독기에 보여줄 순서 — 밈이 실제로 거치는 생애 순서 그대로. */
const LIFECYCLE_ORDER: LifecycleStatus[] = ["rising", "active", "cooling", "archived"];

/** 검색이라는 홈의 한 가지 임무에 집중한 편집형 히어로. */
export function HeroWeb3({ totalCount }: { totalCount: number }) {
  return (
    <section
      aria-label="밈 검색"
      className="relative overflow-hidden border-b border-white/10 bg-void text-white"
    >
      {/* 계측 격자 — 관제 화면의 바닥. 정적이라 성능 비용이 없다. */}
      <div
        aria-hidden
        className="instrument-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_30%_40%,#000,transparent)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-stretch lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <div className="flex flex-col justify-center px-4 py-12 sm:py-16 lg:py-20 lg:pr-14">
          <p className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-white/65">
            {/* 수신 중 표시 — 사전이 지금도 신호를 받고 있다는 상태 */}
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--signal-cyan) opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-(--signal-cyan)" />
            </span>
            Signal desk · Korean meme dictionary
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
                  className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-5 -translate-y-1/2 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                {/* 캐럿을 브랜드 신호로 — 입력하는 순간에도 Signal Desk 언어가
                   이어진다. 네이티브 input이 그대로 남아 있어 form 제출·IME·
                   스크린리더는 기존과 동일하게 동작한다. */}
                <LiveCaretInput
                  id="home-search"
                  name="q"
                  type="search"
                  placeholder="궁금한 밈·유행어를 검색해보세요"
                  autoComplete="off"
                  enterKeyHint="search"
                  color="var(--flame-500)"
                  caretWidth={2}
                  className="h-12 w-full rounded-xl focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent"
                  fieldClassName="pl-11 pr-3 text-base leading-[3rem] text-neutral-950"
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

          {/* 예시 검색어 (LOOP.md §5) — 처음 온 사용자가 "무엇을 검색하는 곳인지"를
              입력 없이 파악하게 한다. 실시간 인기어가 아니라 서비스의 검색 유형
              (유행어·챌린지·추억 밈)을 하나씩 보여주는 고정 예시다 — 트래픽이 아직
              낮아 인기어 집계가 표본 부족이고(랭킹 표본 경고와 같은 이유), 고정
              예시는 개인정보·수집 이슈가 없다. */}
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-white/58">
            <span>예시:</span>
            {/* 세 예시 = 최신 챌린지 · 일상 유행어 · 추억 밈 — 전부 실제 공개 문서가
                있는 검색어여야 한다(예시가 zero-result로 이어지면 역효과). */}
            {["꼬셔야겠어 챌린지", "브금", "잘자 내꿈꿔"].map((q) => (
              <Link
                key={q}
                href={`/search?q=${encodeURIComponent(q)}`}
                className="inline-flex min-h-8 items-center rounded-full border border-white/25 px-3 font-medium text-white/85 transition-colors hover:border-white/60 hover:text-white"
              >
                {q}
              </Link>
            ))}
          </p>

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
            <source srcSet="/brand/hero-signal-desk.avif" type="image/avif" />
            {/* 정적 브랜드 자산은 public 경로와 고정 크기를 사용한다.
               키 비주얼은 아래 판독기의 파형 언어를 그대로 확대한 화면이다. */}
            <img
              src="/brand/hero-signal-desk.webp"
              alt=""
              width={1600}
              height={893}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-[58%_38%]"
            />
          </picture>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/15"
          />
          {/* 생애주기 판독기 — 사이트 전체에서 쓰는 파형 언어를 여기서 한 번에
             가르친다. 카드마다 반복되는 시그니처의 범례 역할. */}
          <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/12 bg-ink/70 p-4 backdrop-blur-md">
            <p className="text-[15px] font-bold leading-snug text-white">
              밈마다 지금 어느 단계인지 읽어드려요.
            </p>
            <ul className="mt-3 grid gap-1.5">
              {LIFECYCLE_ORDER.map((status) => (
                <li key={status} className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
                  <SignalTrace status={status} />
                  <span className="font-mono text-[11px] text-white/62">
                    {LIFECYCLE_STATUS[status].user}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
