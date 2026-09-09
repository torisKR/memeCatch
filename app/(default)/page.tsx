import Link from "next/link";
import { AdsenseScript } from "@/components/adsense-script";
import {
  HomePathwaysSection,
  SafetySignalSection,
  SubmitCtaSection,
} from "@/components/home-sections";
import { HeroWeb3 } from "@/components/hero-web3";
import { DefinedTermSetJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { MemeCompactCard } from "@/components/meme-compact-card";
import { getTotalMemeCount, getTrendingMemes } from "@/lib/queries";

/** 홈 문서는 요청별 SSR. 명시적으로 캐시 가능한 데이터는 5분 단위로 갱신한다. */
export const revalidate = 300;

/** 홈은 검색과 서비스 이해, 각 전용 페이지로의 진입만 담당한다. */
export default async function Home() {
  const [trending, totalCount] = await Promise.all([
    getTrendingMemes(6),
    getTotalMemeCount(),
  ]);

  return (
    <main className="bg-background text-foreground">
      <AdsenseScript />
      <WebSiteJsonLd />
      <DefinedTermSetJsonLd />
      <HeroWeb3 totalCount={totalCount} />

      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-14 sm:gap-16 sm:py-16">
        {trending.length > 0 && (
          <section
            aria-labelledby="sec-trending"
            className="rounded-2xl border border-border bg-surface px-5 py-8 shadow-sm sm:px-8 sm:py-10"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-accent-text">지금 발견되는 밈</p>
                <h2 id="sec-trending" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  밈캐치 내 급상승
                </h2>
              </div>
              <Link
                href="/rankings"
                prefetch={false}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text transition-colors duration-200 hover:text-accent motion-reduce:transition-none"
              >
                급상승 전체 보기 <span aria-hidden className="ml-1">→</span>
              </Link>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {trending.map((meme, index) => (
                <li key={meme.id} className="min-w-0">
                  <MemeCompactCard meme={meme} rank={index + 1} priority={index < 2} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <SafetySignalSection />
        <HomePathwaysSection />
        <SubmitCtaSection />
      </div>
    </main>
  );
}
