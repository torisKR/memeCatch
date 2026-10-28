import type { Metadata } from "next";
import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { getTrendingMemes, searchMemes } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { TrackedBlock } from "@/components/tracked-block";
import { SearchOutcomeTracker } from "@/components/search-outcome-tracker";
import { SearchInput } from "./search-input";
import { MemeReferenceSearch } from "@/components/meme-reference-search";

const SEARCH_DESCRIPTION =
  "밈 이름·초성·별칭을 바로 찾고, 상황에 맞는 관련 밈도 별도로 살펴보세요.";

export const metadata: Metadata = {
  title: "검색",
  description: SEARCH_DESCRIPTION,
  // 루트 canonical("/") 상속 방지 — ?q= 쿼리 변형은 기본 경로로 수렴
  alternates: { canonical: "/search" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  // (페이지 openGraph는 루트 값을 통째로 대체하므로 siteName 등 공통 필드 포함)
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "검색",
    description: SEARCH_DESCRIPTION,
    url: "/search",
  },
};

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] ?? "" : q ?? "").trim();
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
      <p className="mt-1 text-base text-muted">
        이름·초성·별칭을 찾거나 상황으로 관련 밈을 살펴보세요.
      </p>
      <div className="relative mt-5">
        <SearchInput initialQuery={query} popularTerms={popularTerms} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        검색어는 등록된 공개 밈 자료 안에서만 찾아요.
      </p>
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
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
        <aside
          data-search-no-exact-match
          role="status"
          className="mt-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold">이름·별칭으로 일치하는 밈은 없어요.</p>
            <p className="mt-0.5 text-xs text-muted">아래 상황·의미 검색은 별도로 확인해요.</p>
          </div>
          <Link
            href={`/submit?name=${encodeURIComponent(query)}`}
            rel="nofollow"
            className="inline-flex min-h-9 shrink-0 items-center justify-center self-start rounded-full border border-border px-3 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent sm:self-auto"
          >
            이 검색어 제보
          </Link>
        </aside>
      )}

      {query && (
        <MemeReferenceSearch
          query={query}
          variant="search"
          locale="ko"
          autoIntentRouting
          excludeIds={results.map((meme) => meme.id)}
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
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
