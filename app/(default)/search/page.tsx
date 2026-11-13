import type { Metadata } from "next";
import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { getTrendingMemes, searchMemes } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { MOBILE_CARD_CLEARANCE } from "@/components/mobile-card-clearance";
import { StatusPanel } from "@/components/status-panel";
import { TrackedBlock } from "@/components/tracked-block";
import { SearchOutcomeTracker } from "@/components/search-outcome-tracker";
import { SearchInput } from "./search-input";
import { MemeReferenceSearch } from "@/components/meme-reference-search";
import { koreanPageShare } from "@/lib/korean-share-metadata";

const SEARCH_DESCRIPTION =
  "밈 이름, 초성, 별칭으로 무슨 밈인지 바로 찾아보세요.";

export const metadata: Metadata = {
  title: "검색",
  description: SEARCH_DESCRIPTION,
  // 루트 canonical("/") 상속 방지 — ?q= 쿼리 변형은 기본 경로로 수렴
  alternates: { canonical: "/search" },
  ...koreanPageShare({
    title: "검색",
    description: SEARCH_DESCRIPTION,
    pathname: "/search",
  }),
};

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim();
  const results = query ? await searchMemes(query) : [];
  const needsFallback = !query || results.length === 0;
  // 인기 검색어(입력창 하단 칩)와 폴백 그리드가 같은 급상승 쿼리를 공유한다 — 별도 쿼리 추가 금지.
  const trending = await getTrendingMemes(8);
  const popularTerms = trending.map((meme) => meme.title);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
        Search
      </p>
      <h1 className="mt-1 text-2xl font-bold">밈 검색</h1>
      <p className="mt-1 text-base text-muted">이름·초성·별칭으로 바로 찾아보세요.</p>
      <div className="relative mt-5">
        <SearchInput initialQuery={query} popularTerms={popularTerms} />
      </div>
      {query && <MemeReferenceSearch query={query} variant="search" />}

      {/* 검색 성공률 계측 — 결과가 실제로 렌더된 시점 기준(입력 중간 상태 제외) */}
      <SearchOutcomeTracker query={query} resultCount={results.length} />

      {query && results.length > 0 && (
        <section
          aria-label="검색 결과"
          className="instrument-grid mt-6 rounded-2xl border border-border/70 p-3"
        >
          <p className="text-base text-muted">
            &lsquo;{query}&rsquo; 검색 결과 <span className="stat-mono">{results.length}</span>개예요.
          </p>
          <TrackedBlock event="search_result_click" params={{ query }}>
            <ul className={`mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 ${MOBILE_CARD_CLEARANCE}`}>
              {results.map((meme) => (
                <li key={meme.id} className="min-w-0">
                  <MemeCard meme={meme} />
                </li>
              ))}
            </ul>
          </TrackedBlock>
        </section>
      )}

      {query && results.length === 0 && (
        <StatusPanel
          className="mt-6"
          role="status"
          tone="missing"
          label="아직 미포착"
          title="이 밈, 저희도 아직 몰라요"
          description="제보해 주시면 뜻과 유래를 정리해서 알려드려요."
          actions={
            <Link
              href={`/submit?name=${encodeURIComponent(query)}`}
              rel="nofollow"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-[0.97]"
            >
              &lsquo;{query}&rsquo; 제보하기
            </Link>
          }
        />
      )}

      {!query && (
        <section aria-labelledby="search-themes" className="mt-7">
          <h2 id="search-themes" className="text-lg font-bold">
            테마로 시작해 볼까요?
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {COLLECTIONS.slice(0, 6).map((collection) => (
              <li key={collection.slug}>
                <Link
                  href={`/collections/${collection.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {collection.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {needsFallback && trending.length > 0 && (
        <section aria-labelledby="search-trending" className="mt-8">
          <h2 id="search-trending" className="text-xl font-bold">
            {SECTION_TITLES.trending}
          </h2>
          <ul className={`mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 ${MOBILE_CARD_CLEARANCE}`}>
            {trending.slice(0, 6).map((meme) => (
              <li key={meme.id} className="min-w-0">
                <MemeCard meme={meme} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
