import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { getBeginnerMemes, getTotalMemeCount, getTrendingMemes } from "@/lib/queries";
import { COLLECTIONS } from "@/lib/collections";
import { TodayMeme } from "@/components/today-meme";
import { ResumeStrip } from "@/components/resume-strip";
import { MemeCard } from "@/components/meme-card";
import { TrendingCarousel } from "@/components/trending-carousel";
import { StatusPanel } from "@/components/status-panel";
import { DefinedTermSetJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { HeroWeb3 } from "@/components/hero-web3";
// 레인 B 모션 래퍼(클라이언트): 스크롤 리빌 + 스태거 리스트
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";

/** 홈 문서는 요청별 SSR. revalidate는 명시적으로 캐시 가능한 fetch의 세그먼트 기본값이다. */
export const revalidate = 300;

export default async function Home() {
  const [trending, beginners, totalCount] = await Promise.all([
    getTrendingMemes(10),
    getBeginnerMemes(8),
    getTotalMemeCount(),
  ]);
  // 섹션당 3개 미만이면 섹션 숨김
  const showTrending = trending.length >= 3;
  const showBeginners = beginners.length >= 3;
  // 인기 검색어 칩 — 급상승 밈 제목 재사용(별도 쿼리 없음)
  const popularTerms = trending.slice(0, 8).map((m) => m.title);

  return (
    <main className="pb-12">
      <WebSiteJsonLd />
      <DefinedTermSetJsonLd />
      {/* 풀블리드 web3 히어로 — 컨테이너 밖 */}
      <HeroWeb3
        trending={trending}
        totalCount={totalCount}
        popularTerms={popularTerms}
      />
      <div className="mx-auto max-w-3xl px-4">

      {showTrending && (
        <section aria-labelledby="sec-trending" className="mt-2">
          <Reveal>
            <div className="flex items-end justify-between gap-3">
              <h2 id="sec-trending" className="flex items-center gap-1.5 text-xl font-bold">
                <span aria-hidden className="text-life-rising">
                  <FlameMark />
                </span>
                {SECTION_TITLES.trending}
              </h2>
              <Link
                href="/explore"
                className="flex min-h-11 shrink-0 items-center rounded-md py-1 text-sm font-medium text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                전체 보기 <span aria-hidden>→</span>
              </Link>
            </div>
            {/* 급상승 스트립: 자동 이동 캐러셀 (호버/터치 시 정지, reduced-motion 존중) */}
            <TrendingCarousel memes={trending} />
          </Reveal>
        </section>
      )}

      {/* Wave 1: 오늘의 밈(D1) + 이어보기 줄(D2) */}
      <TodayMeme />
      <ResumeStrip />

      {showBeginners && (
        // 섹션 배경 --cream으로 교차(리듬) — 토큰 미정의 시 surface-2로 안전 폴백
        <section
          aria-labelledby="sec-beginner"
          className="mt-8 rounded-3xl p-5 sm:p-6"
          style={{ background: "var(--cream, var(--surface-2))" }}
        >
          <Reveal>
            <h2 id="sec-beginner" className="text-xl font-bold">
              {SECTION_TITLES.forBeginners}
            </h2>
          </Reveal>
          {/* 큐레이션 그리드: 스크롤 리빌 + 카드 스태거 진입 */}
          <MotionList className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {beginners.map((meme) => (
              <MemeCard key={meme.id} meme={meme} />
            ))}
          </MotionList>
        </section>
      )}

      {/* 테마별 모음 허브 — 미드테일 검색 유입 + 내부 링크 */}
      <section aria-labelledby="sec-collections" className="mt-8">
        <Reveal>
          <h2 id="sec-collections" className="text-xl font-bold">
            테마별 밈 모음
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {COLLECTIONS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/collections/${c.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* 이렇게도 둘러보세요 — 연표·주간결산 진입 (체류·재방문) */}
      <Reveal>
        <section aria-labelledby="sec-discover" className="mt-8">
          <h2 id="sec-discover" className="sr-only">
            더 둘러보기
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li>
              <Link
                href="/timeline"
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 12h16" />
                    <circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="13" cy="12" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">밈 연표</span>
                  <span className="block truncate text-sm text-muted">
                    1990년대부터 지금까지 연대별로
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/weekly"
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 19V5M12 19V9M19 19v-6" />
                    <path d="M3 19h18" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">이번 주 밈 결산</span>
                  <span className="block truncate text-sm text-muted">
                    급상승·신규를 매주 자동 정리
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/news"
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 4h14v16H5z" />
                    <path d="M8 8h8M8 12h8M8 16h5" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">세대별 밈 소식</span>
                  <span className="block truncate text-sm text-muted">
                    20·30·40대별 핵심 정보만
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/products"
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 8h14l-1 12H6L5 8Z" />
                    <path d="M9 9V6a3 3 0 0 1 6 0v3" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">밈 상품</span>
                  <span className="block truncate text-sm text-muted">
                    광고 고지와 조건을 먼저 확인
                  </span>
                </span>
              </Link>
            </li>
          </ul>
        </section>
      </Reveal>

      {(showTrending || showBeginners) && (
        <Reveal>
          {/* 전체 밈 보기 — /explore 진입 CTA */}
          <Link
            href="/explore"
            className="mt-8 flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface text-base font-semibold shadow-sm transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
          >
            전체 밈 보기 <span aria-hidden>→</span>
          </Link>
        </Reveal>
      )}

      {!showTrending && !showBeginners && (
        <StatusPanel
          className="mt-6"
          label="캐치 신호 준비 중"
          title="새 밈을 같이 채워주세요"
          description="테마를 먼저 둘러보거나, 지금 궁금한 밈을 제보해 주세요."
          tone="waiting"
          actions={
            <>
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-base font-bold text-white transition-transform active:scale-[0.97]"
              >
                밈 탐색하기
              </Link>
              <Link
                href="/submit"
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent"
              >
                밈 제보하기
              </Link>
            </>
          }
        />
      )}
      </div>
    </main>
  );
}

function FlameMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5c.6 3.2-1.8 4.9-1.8 7.4a2.6 2.6 0 0 0 5.2.3c1.7 1.6 2.6 3.4 2.6 5.3a6 6 0 1 1-12 0c0-2.6 1.3-4.5 3-6.2.3 1.4.9 2.3 1.7 2.8-.4-3.3.1-6.4 1.3-9.6Z" />
    </svg>
  );
}
