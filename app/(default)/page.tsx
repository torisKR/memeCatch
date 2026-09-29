import type { Metadata } from "next";
import { AdsenseScript } from "@/components/adsense-script";
import { HomeExperience } from "@/components/home/home-experience";
import { DefinedTermSetJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import {
  SEO_ROUTE_LOCALES,
  buildHreflangLanguages,
  getSeoCopy,
  localizePath,
} from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";
import { getRecentlyPublishedMemes } from "@/lib/queries";

/** 홈 문서는 요청별 SSR. 명시적으로 캐시 가능한 데이터는 5분 단위로 갱신한다. */
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: {
      ...buildHreflangLanguages("/", SEO_ROUTE_LOCALES),
      // 해외 주 타깃 전환: 언어 미상 방문자는 영어 홈으로 보낸다.
      "x-default": localizePath("/", "en"),
    },
  },
};

/** 홈은 검색과 서비스 이해, 각 전용 페이지로의 진입만 담당한다. */
export default async function Home() {
  const latest = await getRecentlyPublishedMemes(6);
  const categoryCopy = getSeoCopy("ko").categories;
  const entries = latest.map((meme) => ({
    id: meme.id,
    href: memePathFrom(meme.short_id, meme.slug),
    title: meme.title,
    summary: meme.summary,
    categoryLabel: categoryCopy[meme.category],
    safetyLevel: meme.safety_level,
  }));

  return (
    <main className="bg-background text-foreground">
      <AdsenseScript />
      <WebSiteJsonLd />
      <DefinedTermSetJsonLd />
      <HomeExperience locale="ko" entries={entries} />
    </main>
  );
}
