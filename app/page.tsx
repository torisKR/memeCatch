import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { getBeginnerMemes, getTrendingMemes } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { WebSiteJsonLd } from "@/components/json-ld";
import { SearchHero } from "@/components/search-hero";
// 레인 B 모션 래퍼(클라이언트): 스크롤 리빌 + 스태거 리스트
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";

/** 홈 — 공개 ISR (5분), 쿠키 미사용 정적 클라이언트 */
export const revalidate = 300;

export default async function Home() {
  const [trending, beginners] = await Promise.all([
    getTrendingMemes(10),
    getBeginnerMemes(8),
  ]);
  // 섹션당 3개 미만이면 섹션 숨김
  const showTrending = trending.length >= 3;
  const showBeginners = beginners.length >= 3;
  // 인기 검색어 칩 — 급상승 밈 제목 재사용(별도 쿼리 없음)
  const popularTerms = trending.slice(0, 8).map((m) => m.title);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12">
      <WebSiteJsonLd />
      <SearchHero popularTerms={popularTerms} />

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
                className="shrink-0 rounded-md py-1 text-sm font-medium text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                전체 보기 <span aria-hidden>→</span>
              </Link>
            </div>
            {/* 급상승 스트립: 가로 스크롤 + 생명게이지 강조 유지 */}
            <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
              {trending.map((meme) => (
                <li key={meme.id} className="w-40 shrink-0 snap-start">
                  <MemeCard meme={meme} />
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      )}

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
        <section className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-bold">아직 준비된 밈이 부족해요</p>
          <p className="mt-1 text-base text-muted">
            밈을 차곡차곡 정리하고 있어요. 조금만 기다려 주세요.
          </p>
        </section>
      )}
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
