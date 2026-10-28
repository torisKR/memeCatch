import type { Metadata } from "next";
import { cache } from "react";
import { HomeExperience } from "@/components/home/home-experience";
import { CommunityMemeBattle } from "@/components/home/community-meme-battle";
import { getCommunityMemeBattle } from "@/lib/community-battle.server";
import { DefinedTermSetJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { getEditorialHomeMemes } from "@/lib/home-editorial.server";
import { getPublicHomeTrendSummaries } from "@/lib/trend/public-evidence.server";
import {
  SEO_CONTENT_LOCALES,
  buildHreflangLanguages,
  getSeoCopy,
} from "@/lib/i18n-routing";
import { getLocalizedFeaturedMemesResult } from "@/lib/meme-translations";
import { memePathFrom } from "@/lib/labels";

/** 홈 문서는 요청별 SSR. 명시적으로 캐시 가능한 데이터는 5분 단위로 갱신한다. */
export const revalidate = 300;

const getRootTranslationCoverage = cache(async () =>
  Promise.allSettled(
    SEO_CONTENT_LOCALES.map(async (locale) => ({
      locale,
      // A single eligible item proves that the locale root has real reviewed
      // coverage. The loader remains bounded and applies public-media gates.
      result: await getLocalizedFeaturedMemesResult(locale, 1),
    })),
  ),
);

export async function generateMetadata(): Promise<Metadata> {
  const coveredLocales: (typeof SEO_CONTENT_LOCALES)[number][] = [];
  const coverage = await getRootTranslationCoverage();
  for (const [index, outcome] of coverage.entries()) {
    const locale = SEO_CONTENT_LOCALES[index];
    if (outcome.status === "rejected") {
      // Fixed diagnostic code plus an allowlisted locale only. Provider
      // messages, credentials and request data are intentionally discarded.
      console.warn("localized_home_coverage_unavailable", locale);
      continue;
    }
    if (outcome.value.result.status === "active") {
      coveredLocales.push(outcome.value.locale);
    }
  }

  return {
    alternates: {
      canonical: "/",
      languages: {
        ...buildHreflangLanguages("/", ["ko", ...coveredLocales]),
        "x-default": "/",
      },
    },
  };
}

/** 홈은 검색과 서비스 이해, 각 전용 페이지로의 진입만 담당한다. */
export default async function Home() {
  const [editorial, externalTrends, battleBoards] = await Promise.all([
    getEditorialHomeMemes(6),
    getPublicHomeTrendSummaries(4),
    getCommunityMemeBattle(),
  ]);
  const categoryCopy = getSeoCopy("ko").categories;
  const entries = editorial.items.map((meme) => ({
    id: meme.id,
    href: memePathFrom(meme.short_id, meme.slug),
    title: meme.title,
    summary: meme.summary,
    categoryLabel: categoryCopy[meme.category],
    safetyLevel: meme.safety_level,
    category: meme.category,
    thumbnailUrl: meme.meme_contents?.find((content) => content.is_representative && content.thumbnail_url)?.thumbnail_url
      ?? meme.meme_contents?.find((content) => content.thumbnail_url)?.thumbnail_url
      ?? null,
  }));

  return (
    <main className="bg-background text-foreground">
      <WebSiteJsonLd />
      <DefinedTermSetJsonLd />
      {/* 넓은 화면(xl 이상)에서는 밈대결 패널을 오른쪽에 고정하고, 좁은 화면에서는 본문 아래에 둔다. */}
      <div className="mx-auto max-w-[92rem] xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6 xl:px-6">
        <div className="min-w-0">
          <HomeExperience
            locale="ko"
            entries={entries}
            entryState={editorial.status}
            externalTrends={externalTrends}
          />
        </div>
        <aside aria-label="커뮤니티 밈대결" className="px-4 pb-8 xl:px-0 xl:pb-0 xl:pt-6">
          <div className="xl:sticky xl:top-20">
            <CommunityMemeBattle boards={battleBoards} />
          </div>
        </aside>
      </div>
    </main>
  );
}
