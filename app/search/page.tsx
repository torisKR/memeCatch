import type { Metadata } from "next";
import Link from "next/link";
import { SECTION_TITLES } from "@/lib/labels";
import { getTrendingMemes, searchMemes } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
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
      <h1 className="sr-only">밈 검색</h1>
      <SearchInput initialQuery={query} />

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
        <section
          aria-label="검색 결과 없음"
          className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center"
        >
          <p className="text-xl font-bold">이 밈, 저희도 아직 몰라요</p>
          <p className="mt-1.5 text-base text-muted">
            제보해 주시면 뜻과 유래를 정리해서 알려드려요.
          </p>
          <Link
            href={`/submit?name=${encodeURIComponent(query)}`}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-base font-bold text-white"
          >
            &lsquo;{query}&rsquo; 제보하기
          </Link>
        </section>
      )}

      {!query && (
        <p className="mt-6 text-base text-muted">
          밈 이름이나 초성(예: ㅇㅈ)으로 검색할 수 있어요.
        </p>
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
