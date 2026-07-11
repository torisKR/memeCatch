import type { Metadata } from "next";
import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { getTrendingMemes, searchMemes } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { StatusPanel } from "@/components/status-panel";
import { SearchInput } from "./search-input";

export const metadata: Metadata = {
  title: "검색",
  description: "밈 이름, 초성, 별칭으로 무슨 밈인지 바로 찾아보세요.",
};

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim();
  const results = query ? await searchMemes(query) : [];
  const needsFallback = !query || results.length === 0;
  const trending = needsFallback ? await getTrendingMemes(6) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-14 pt-6">
      <h1 className="text-2xl font-bold">밈 검색</h1>
      <p className="mt-1 text-base text-muted">이름·초성·별칭으로 바로 찾아보세요.</p>
      <div className="mt-5">
        <SearchInput initialQuery={query} />
      </div>

      {query && results.length > 0 && (
        <section aria-label="검색 결과" className="mt-6">
          <p className="text-base text-muted">
            &lsquo;{query}&rsquo; 검색 결과 {results.length}개예요.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {results.map((meme) => (
              <li key={meme.id} className="min-w-0">
                <MemeCard meme={meme} />
              </li>
            ))}
          </ul>
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
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-base font-bold text-white transition-transform active:scale-[0.97]"
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
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {trending.map((meme) => (
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
