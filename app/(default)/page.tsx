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

      <div className="mx-auto max-w-6xl px-4">
        <SafetySignalSection />
        <HomePathwaysSection />

        {trending.length > 0 && (
          <section aria-labelledby="sec-trending" className="border-t border-border py-10 sm:py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
                  Live ranking
                </p>
                <h2 id="sec-trending" className="mt-1.5 text-2xl font-extrabold tracking-tight">
                  지금 뜨는 밈
                </h2>
              </div>
              <Link
                href="/rankings"
                prefetch={false}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-muted transition-colors hover:text-accent"
              >
                전체 랭킹 <span aria-hidden className="ml-1">→</span>
              </Link>
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {trending.map((meme, index) => (
                <li key={meme.id} className="min-w-0">
                  <MemeCompactCard meme={meme} rank={index + 1} priority={index < 2} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <SubmitCtaSection />
      </div>
    </main>
  );
}
