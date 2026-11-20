import type { Metadata } from "next";
import { AdsenseScript } from "@/components/adsense-script";
import { HomeExperience } from "@/components/home/home-experience";
import { DailyMemeQuiz } from "@/components/daily-meme-quiz";
import { DefinedTermSetJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import {
  SEO_ROUTE_LOCALES,
  KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES,
  buildHreflangLanguages,
  getSeoCopy,
  localizePath,
} from "@/lib/i18n-routing";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";
import { memePathFrom } from "@/lib/labels";
import { getRecentlyPublishedMemes } from "@/lib/queries";
import { getGuaranteedHomeEntries } from "@/lib/curated-memes";
import { CommunityMemeBattle } from "@/components/home/community-meme-battle";
import { getCommunityMemeBattle } from "@/lib/community-battle.server";
import { loadDiscoveryIndex } from "@/lib/index-gate.server";

/** 홈 문서는 요청별 SSR. ISR 재생성 비용을 줄이려고 1시간 단위로 캐시한다. */
export const revalidate = 3600;

export const metadata: Metadata = {
  // twitter 제목·설명은 Next가 openGraph 값을 이어받는다.
  description: getSeoCopy("ko").description,
  alternates: {
    canonical: "/",
    languages: {
      ...buildHreflangLanguages("/", SEO_ROUTE_LOCALES),
      // 해외 주 타깃 전환: 언어 미상 방문자는 영어 홈으로 보낸다.
      "x-default": localizePath("/", "en"),
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    description: getSeoCopy("ko").description,
    siteName: "밈캐치",
    locale: "ko_KR",
    alternateLocale: KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES,
    images: [ogDefaultImageDescriptor("ko")],
  },
};

/** 홈은 검색과 서비스 이해, 각 전용 페이지로의 진입만 담당한다. */
export default async function Home() {
  const discovery = await loadDiscoveryIndex();
  const latest = discovery.ok
    ? await getRecentlyPublishedMemes(6, discovery.ids)
    : [];
  const categoryCopy = getSeoCopy("ko").categories;
  const rawEntries = latest.map((meme) => ({
    id: meme.id,
    href: memePathFrom(meme.short_id, meme.slug),
    title: meme.title,
    summary: meme.summary,
    categoryLabel: categoryCopy[meme.category],
    safetyLevel: meme.safety_level,
    category: meme.category,
    originYear: meme.origin_year,
    contents: meme.meme_contents,
    thumbnailUrl: meme.meme_contents?.find((content) => content.is_representative && content.thumbnail_url)?.thumbnail_url
      ?? meme.meme_contents?.find((content) => content.thumbnail_url)?.thumbnail_url
      ?? null,
  }));
  const entries = getGuaranteedHomeEntries("ko", rawEntries);
  const battleBoards = (await getCommunityMemeBattle()).filter((board) => board.status === "ready");

  return (
    <main className="bg-background text-foreground">
      <AdsenseScript />
      <WebSiteJsonLd />
      <DefinedTermSetJsonLd />
      <div className={battleBoards.length > 0 ? "xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start" : undefined}>
        <HomeExperience locale="ko" entries={entries} afterHero={<DailyMemeQuiz />} />
        {battleBoards.length > 0 ? (
          <aside className="px-4 pb-8 xl:pr-4 xl:pl-0">
            <CommunityMemeBattle boards={battleBoards} />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
