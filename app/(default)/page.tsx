import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { getBeginnerMemes, getTotalMemeCount, getTrendingMemes } from "@/lib/queries";
import { TodayMeme } from "@/components/today-meme";
import { ResumeStrip } from "@/components/resume-strip";
import { TrendingCarousel } from "@/components/trending-carousel";
import { StatusPanel } from "@/components/status-panel";
import { DefinedTermSetJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { HeroWeb3 } from "@/components/hero-web3";
import { Reveal } from "@/components/reveal";
import { DonateCard } from "@/components/donate-card";
import { MemeGuessGame } from "@/components/meme-guess-game";
import {
  CategoryBentoSection,
  EraArchiveSection,
  SafetySignalSection,
  SubmitCtaSection,
} from "@/components/home-sections";
import { AdsenseScript } from "@/components/adsense-script";

/** 홈 문서는 요청별 SSR. revalidate는 명시적으로 캐시 가능한 fetch의 세그먼트 기본값이다. */
export const revalidate = 300;

/**
 * 홈 = 랜딩페이지 (2026-07 전면 리뉴얼).
 * 구조: Hero(검색·CTA·신호 티커) → 안전 신호 설명 → 카테고리 벤토 →
 *       급상승 → 시대별 아카이브 → 오늘의 밈·밈력 게임 → 더 둘러보기 →
 *       제보 CTA → 후원.
 * 이전의 주간 브리핑·입문자 그리드는 벤토/급상승과 중복이라 통합 제거
 * (주간 결산은 /weekly, 입문 큐레이션은 벤토의 입문 코스 타일이 담당).
 */
export default async function Home() {
  const [trending, beginners, totalCount] = await Promise.all([
    getTrendingMemes(10),
    getBeginnerMemes(8),
    getTotalMemeCount(),
  ]);
  const showTrending = trending.length >= 3;
  // 인기 검색어 칩 — 급상승 밈 제목 재사용(별도 쿼리 없음)
  const popularTerms = trending.slice(0, 8).map((m) => m.title);

  return (
    // 다크 web3 스킨은 layout의 body.theme-ink가 전역 적용(전 사이트 통일)
    <main className="relative isolate overflow-x-clip bg-background pb-12 text-foreground">
      <AdsenseScript />
      {/* 잉크 배경 미세 그리드 — 히어로 §12 문법을 본문 전체로 확장(정적 장식) */}
      <div aria-hidden className="ink-grid pointer-events-none absolute inset-0 -z-10" />
      <WebSiteJsonLd />
      <DefinedTermSetJsonLd />
      {/* 풀블리드 랜딩 히어로 — 컨테이너 밖 */}
      <HeroWeb3
        trending={trending}
        totalCount={totalCount}
        popularTerms={popularTerms}
      />
      <div className="mx-auto max-w-5xl px-4">
        {/* D. 사용 안전 신호 — 서비스 차별점을 첫 스크롤에서 설명 */}
        <Reveal>
          <SafetySignalSection />
        </Reveal>

        {/* E. 카테고리 벤토 — 전부 실동작 /explore 필터 쿼리 진입점 */}
        <Reveal>
          <CategoryBentoSection />
        </Reveal>

        {/* F. 급상승 캐러셀 */}
        {showTrending && (
          <section aria-labelledby="sec-trending" className="mt-10">
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
              {/* 자동 이동 캐러셀 (호버/터치 시 정지, reduced-motion 존중) */}
              <TrendingCarousel memes={trending} />
            </Reveal>
          </section>
        )}

        {/* G. 시대별 아카이브 — 연표·연대 필터 진입 */}
        <Reveal>
          <EraArchiveSection />
        </Reveal>

        {/* H. 오늘의 밈 + 이어보기 + 밈력 게임 */}
        <TodayMeme />
        <ResumeStrip />
        <MemeGuessGame memes={beginners.length >= 3 ? beginners : trending} />

        {/* 더 둘러보기 — 사전·퀴즈·결산·소식·상품 내부 링크 허브 */}
        <Reveal>
          <section aria-labelledby="sec-discover" className="mt-10">
            <h2 id="sec-discover" className="sr-only">
              더 둘러보기
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <li>
                <Link
                  href="/slang"
                  prefetch={false}
                  className="hover-glow-flame flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5V6a2 2 0 0 1 2-2h14v13.5H6a2 2 0 0 0-2 2Z" />
                      <path d="M4 19.5A2 2 0 0 0 6 21.5h14" />
                      <path d="M9 8.5h6M9 12h3.5" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">줄임말·유행어 사전</span>
                    <span className="block truncate text-sm text-muted">
                      그때는 하이루, 지금은 럭키비키
                    </span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/quiz"
                  prefetch={false}
                  className="hover-glow-flame flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h7" />
                      <path d="m8 8 1.2 1.2L11.5 7" />
                      <path d="M13.5 8.5H16" />
                      <path d="m8 13.5 1.2 1.2 2.3-2.2" />
                      <path d="m17.5 11 2.5 2.5-5 5-3 .5.5-3 5-5Z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">밈력고사</span>
                    <span className="block truncate text-sm text-muted">
                      내 밈력은 몇 점? 10문항 스피드 퀴즈
                    </span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/weekly"
                  prefetch={false}
                  className="hover-glow-flame flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
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
                  prefetch={false}
                  className="hover-glow-flame flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
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
                  prefetch={false}
                  className="hover-glow-flame flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
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
              <li>
                <Link
                  href="/rankings"
                  prefetch={false}
                  className="hover-glow-flame flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 21h8M12 17v4" />
                      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                      <path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">밈 랭킹</span>
                    <span className="block truncate text-sm text-muted">
                      기간별 인기 밈 순위
                    </span>
                  </span>
                </Link>
              </li>
            </ul>
          </section>
        </Reveal>

        {!showTrending && (
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
                  className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97]"
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

        {/* I. 제보 CTA */}
        <Reveal>
          <SubmitCtaSection />
        </Reveal>

        {/* 후원 — 1인 운영 비영리, 홈 하단에 절제된 안내 */}
        <Reveal>
          <div className="mt-6">
            <DonateCard />
          </div>
        </Reveal>
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
