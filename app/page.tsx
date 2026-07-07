import { SECTION_TITLES } from "@/lib/labels";
import { getBeginnerMemes, getTrendingMemes, type MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { WebSiteJsonLd } from "@/components/json-ld";

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

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12">
      <WebSiteJsonLd />
      {/* 검색 히어로 */}
      <section aria-label="밈 검색" className="pb-8 pt-10 md:pt-16">
        <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">
          그 밈, 3초 안에 알려드려요
        </h1>
        <p className="mt-1.5 text-base text-muted">
          뜻·유래부터 지금 써도 되는지까지 한 번에 확인해요.
        </p>
        <form action="/search" role="search" className="mt-5">
          <label htmlFor="home-search" className="sr-only">
            밈 검색
          </label>
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
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
              placeholder="무슨 밈인지 검색해보세요"
              autoComplete="off"
              enterKeyHint="search"
              className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base shadow-sm outline-none transition-colors focus:border-accent"
            />
          </div>
        </form>
      </section>

      {showTrending && (
        <section aria-labelledby="sec-trending" className="mt-2">
          <h2 id="sec-trending" className="flex items-center gap-1.5 text-xl font-bold">
            <span aria-hidden className="text-life-rising">
              <FlameMark />
            </span>
            {SECTION_TITLES.trending}
          </h2>
          <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {trending.map((meme) => (
              <li key={meme.id} className="w-40 shrink-0 snap-start">
                <MemeCard meme={meme} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {showBeginners && (
        <section aria-labelledby="sec-beginner" className="mt-8">
          <h2 id="sec-beginner" className="text-xl font-bold">
            {SECTION_TITLES.forBeginners}
          </h2>
          <MemeGrid memes={beginners} />
        </section>
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

function MemeGrid({ memes }: { memes: MemeListItem[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
      {memes.map((meme) => (
        <li key={meme.id} className="min-w-0">
          <MemeCard meme={meme} />
        </li>
      ))}
    </ul>
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
