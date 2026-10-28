import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { isIndexableMeme, type DepthContentRef, type DepthTagRef } from "@/lib/content-depth";
import { evidenceTimestamp, type SourceLink } from "@/lib/source-links";
import { resolveMemeDelivery } from "@/lib/meme-delivery";
import { publicEditorialEligibilityInput } from "@/lib/meme-public-detail";
import { filterPublicMemeMedia } from "@/lib/sources/public-links.server";
import { isTranslationCurrent } from "@/lib/meme-translations";
import { originCountryCode, type MemeOriginProfile } from "@/lib/meme-country";
import {
  SEO_CONTENT_LOCALES,
  SEO_ROUTE_LOCALES,
  isSeoContentLocale,
  localizedMemePath,
  localizedPath,
  toHrefLang,
  type SeoContentLocale,
} from "@/lib/i18n-routing";


/** 1시간마다 재생성 — 새로 공개된 밈 반영 */
export const revalidate = 3600;

/** 공개(=200으로 렌더되는) 밈 상태: approved + limited. */
const PUBLIC_STATUSES = ["approved", "limited"] as const;

/** Google's per-sitemap protocol limit. */
const MAX_SITEMAP_URLS = 50_000;
const MIN_LOCALIZED_EXPLORE_ITEMS = 24;

/**
 * 충실도 판정에 필요한 신호까지 함께 실어 온다.
 * 상세 페이지의 robots 판정(app/(default)/memes/[key]/page.tsx)과 **같은 신호**를 넘겨야
 * "사이트맵엔 있는데 noindex" 같은 모순이 생기지 않는다. 신호를 하나 빼면
 * 그 밈은 점수가 낮게 나와 조용히 색인에서 빠지므로 컬럼 변경 시 양쪽을 함께 본다.
 */
const DEPTH_SELECT =
  "short_id, slug, updated_at, title, summary, published_at, moderation_status, description, origin, usage_note, caution, usage_examples," +
  // Same relation DTOs as detail queries: older local schemas may not yet have
  // optional production_id columns. Explicitly selecting a missing column would
  // turn the entire sitemap into a 500; `*` includes it only where installed.
  // These rows stay server-side; only eligible canonical URLs are serialized.
  " meme_sources(*), meme_contents(*)," +
  " meme_tags_map(tag_id)," +
  " meme_market_profiles(market_code, role, review_state)," +
  " meme_translations(locale, status, localized_slug, source_updated_at, updated_at, title, summary, description, origin)";

type SitemapTranslationRow = {
  locale: string;
  status: string;
  localized_slug: string;
  source_updated_at: string;
  updated_at: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
};

type SitemapMemeRow = Parameters<typeof publicEditorialEligibilityInput>[0]["meme"] & {
  short_id: string;
  slug: string;
  updated_at: string;
  meme_tags_map: DepthTagRef[] | null;
  meme_market_profiles: MemeOriginProfile[] | null;
  meme_sources: SourceLink[];
  meme_contents: (DepthContentRef & {
    url?: string | null;
    platform?: string | null;
    content_id?: string | null;
    production_id?: string | null;
  })[];
  meme_translations: SitemapTranslationRow[];
};

function validDate(value: string | null | undefined): Date | undefined {
  const timestamp = evidenceTimestamp(value);
  return timestamp ? new Date(timestamp) : undefined;
}

function lastModified(date: Date | undefined): { lastModified: Date } | Record<string, never> {
  return date ? { lastModified: date } : {};
}

function absolute(pathname: string): string {
  return `${SITE_URL}${pathname === "/" ? "" : pathname}`;
}

function homeLanguages(locales: readonly SeoContentLocale[]): Record<string, string> {
  const languages: Record<string, string> = { ko: absolute("/") };
  for (const locale of locales) {
    languages[toHrefLang(locale)] = absolute(localizedPath("/", locale));
  }
  return { ...languages, "x-default": languages.ko };
}

/** Plus pricing is the other fully localized static conversion page. */
function pricingLanguages(): Record<string, string> {
  return {
    ...Object.fromEntries(
      SEO_ROUTE_LOCALES.map((locale) => [
        toHrefLang(locale),
        absolute(localizedPath("/pricing", locale)),
      ]),
    ),
    "x-default": absolute("/pricing"),
  };
}

function exploreLanguages(locales: readonly SeoContentLocale[]): Record<string, string> {
  const languages: Record<string, string> = {
    ko: absolute("/explore"),
  };
  for (const locale of locales) {
    languages[toHrefLang(locale)] = absolute(localizedPath("/explore", locale));
  }
  return { ...languages, "x-default": languages.ko };
}

/** Only reviewed, exact-source, complete translations may become crawl targets. */
function reviewedTranslations(meme: SitemapMemeRow): Map<SeoContentLocale, SitemapTranslationRow> {
  const translations = new Map<SeoContentLocale, SitemapTranslationRow>();
  for (const translation of meme.meme_translations ?? []) {
    if (!isSeoContentLocale(translation.locale)) continue;
    const isReviewedAndCurrent =
      translation.status === "reviewed" &&
      isTranslationCurrent(translation.source_updated_at, meme.updated_at) &&
      Boolean(translation.title?.trim()) &&
      Boolean(translation.summary?.trim()) &&
      Boolean(translation.description?.trim()) &&
      Boolean(translation.origin?.trim());
    if (!isReviewedAndCurrent) continue;
    translations.set(translation.locale, translation);
  }
  return translations;
}

function memeLanguages(
  meme: SitemapMemeRow,
  translations: Map<SeoContentLocale, SitemapTranslationRow>,
): Record<string, string> {
  const koreanPath = memePathFrom(meme.short_id, meme.slug);
  const languages: Record<string, string> = {
    ko: absolute(koreanPath),
  };
  for (const locale of SEO_CONTENT_LOCALES) {
    const translation = translations.get(locale);
    if (!translation) continue;
    languages[toHrefLang(locale)] = absolute(
      localizedMemePath(
        locale,
        meme.short_id,
        translation.localized_slug || meme.slug,
      ),
    );
  }
  return { ...languages, "x-default": absolute(koreanPath) };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticClient();

  // 홈·탐색은 새 공개 문서가 실제로 노출면을 바꾸므로 최신 공개일을 쓸 수 있다.
  // 데이터가 없으면 요청/빌드 시각을 발명하지 않고 lastModified를 생략한다.
  let homeLastMod: Date | undefined;
  try {
    const { data: latest, error } = await supabase
      .from("memes")
      .select("published_at")
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`[sitemap] 최신 공개일 조회 실패: ${error.message}`, {
        cause: error,
      });
    }
    homeLastMod = validDate(latest?.published_at);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[sitemap]")) throw error;
    throw new Error("[sitemap] 최신 공개일 조회 실패", { cause: error });
  }

  const localizedPricingEntries: MetadataRoute.Sitemap = SEO_CONTENT_LOCALES.map(
    (locale) => ({
      url: absolute(localizedPath("/pricing", locale)),
      changeFrequency: "weekly" as const,
      priority: 0.55,
      alternates: { languages: pricingLanguages() },
    }),
  );
  const localizedHomeLastModified = new Map<SeoContentLocale, Date>();
  const localizedExploreLastModified = new Map<SeoContentLocale, Date>();
  const localizedHomeCounts = new Map<SeoContentLocale, number>();
  const localizedExploreCounts = new Map<SeoContentLocale, number>();

  const rootEntry: MetadataRoute.Sitemap[number] = {
    url: SITE_URL,
    ...lastModified(homeLastMod),
    changeFrequency: "hourly",
    priority: 1,
  };
  const entries: MetadataRoute.Sitemap = [
    rootEntry,
    {
      url: `${SITE_URL}/pricing`,
      changeFrequency: "weekly" as const,
      priority: 0.55,
      alternates: { languages: pricingLanguages() },
    },
    ...localizedPricingEntries,
    {
      url: `${SITE_URL}/collections`,
      changeFrequency: "daily" as const,
      priority: 0.75,
    },
    // 테마별 모음 허브
    ...COLLECTIONS.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // 주요 정적 페이지 — 탐색·커뮤니티·정책
    {
      url: `${SITE_URL}/explore`,
      ...lastModified(homeLastMod),
      changeFrequency: "daily" as const,
      priority: 0.6,
    },
    ...(["/global", "/studio", "/timeline", "/slang", "/quiz", "/weekly", "/rankings", "/community", "/news", "/products", "/about", "/guides/reading-memes", "/editorial", "/privacy", "/terms"] as const).map(
      (path) => ({
        url: `${SITE_URL}${path}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })
    ),
  ];

  // 공개 밈 중 **콘텐츠가 충실한 것만** 색인 노출한다.
  // 공개(approved + limited) 전량을 제출하면 정의 130~150자짜리 얇은 문서가
  // 사이트맵의 대부분을 차지해 대량생산 얇은 콘텐츠로 평가된다(애드센스 거부 사유).
  // 얇은 밈의 상세 페이지는 그대로 200으로 살아 있고 noindex,follow만 붙는다 —
  // 데이터는 삭제하지 않으며 사이트맵에서 발견 경로만 뺀다.
  // 페이지 단위로 순회 — 사이트맵 상한 5만 URL.
  const PAGE = 1000;
  for (let from = 0; from < 49000; from += PAGE) {
    const { data, error } = await supabase
      .from("memes")
      .select(DEPTH_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false })
      // 고유 타이브레이커 필수 — published_at은 동점이 매우 많다(일괄 등록으로
      // 공개 3,905건 중 2,835건이 같은 타임스탬프를 공유). 단일 컬럼 정렬로
      // range() 페이지를 나누면 페이지마다 정렬이 달라져 경계에서 같은 행을
      // 다시 읽고 다른 행은 건너뛴다. 실제로 사이트맵에 URL 2건이 중복 등재되고
      // 충실한 문서 1건이 누락됐다.
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      const message = `[sitemap] 밈 조회 실패 (from=${from}): ${error.message}`;
      console.error(message);
      throw new Error(message, { cause: error });
    }
    if (!data || data.length === 0) break;

    // Raw rows are only a cheap upper bound. As on the detail page, hidden,
    // unplayable and produced media must not grant index eligibility. The
    // score is additive: if public prose/tags alone pass, removal of any media
    // cannot change that verdict. Only boundary rows need ledger lookups.
    const candidates = (data as unknown as SitemapMemeRow[]).filter(isIndexableMeme);
    const independentlyIndexable = new Set(candidates.filter((meme) =>
      isIndexableMeme(publicEditorialEligibilityInput({
        meme,
        originalSources: [],
        renderableContents: [],
      })),
    ));
    const dependentCandidates = candidates.filter((meme) => !independentlyIndexable.has(meme));
    // The shared helper batches refs (200 IDs / 25 legacy TikTok IDs per lane),
    // with at most three concurrent lanes. This is one helper call per DB page,
    // not necessarily a single database request.
    const publicMedia = dependentCandidates.length > 0
      ? await filterPublicMemeMedia({
        sources: dependentCandidates.flatMap((meme) => meme.meme_sources ?? []),
        contents: dependentCandidates.flatMap((meme) => meme.meme_contents ?? []),
      })
      : { sources: [], contents: [] };
    const publicSources = new Set(publicMedia.sources);
    const publicContents = new Set(publicMedia.contents);

    for (const meme of candidates) {
      if (!independentlyIndexable.has(meme)) {
        const delivery = resolveMemeDelivery({
          sources: (meme.meme_sources ?? []).filter((source) => publicSources.has(source)),
          contents: (meme.meme_contents ?? []).filter((content) => publicContents.has(content)),
        });
        const publicDepthInput = publicEditorialEligibilityInput({
          meme,
          originalSources: delivery.originalSources,
          renderableContents: delivery.renderableContents,
        });
        if (!isIndexableMeme(publicDepthInput)) continue;
      }
      const translations = reviewedTranslations(meme);
      const languages = memeLanguages(meme, translations);
      const provesKoreanHomeCoverage = originCountryCode(meme.meme_market_profiles) === "KR";
      for (const [locale, translation] of translations) {
        localizedExploreCounts.set(
          locale,
          (localizedExploreCounts.get(locale) ?? 0) + 1,
        );
        const translationUpdatedAt = validDate(translation.updated_at);
        const currentExploreLatest = localizedExploreLastModified.get(locale);
        if (
          translationUpdatedAt &&
          (!currentExploreLatest || translationUpdatedAt > currentExploreLatest)
        ) {
          localizedExploreLastModified.set(locale, translationUpdatedAt);
        }
        if (!provesKoreanHomeCoverage) continue;
        localizedHomeCounts.set(
          locale,
          (localizedHomeCounts.get(locale) ?? 0) + 1,
        );
        const currentHomeLatest = localizedHomeLastModified.get(locale);
        if (
          translationUpdatedAt &&
          (!currentHomeLatest || translationUpdatedAt > currentHomeLatest)
        ) {
          localizedHomeLastModified.set(locale, translationUpdatedAt);
        }
      }

      if (entries.length < MAX_SITEMAP_URLS) {
        const updatedAt = validDate(meme.updated_at);
        entries.push({
          url: `${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}`,
          ...lastModified(updatedAt),
          changeFrequency: "weekly",
          priority: 0.8,
          alternates: { languages },
        });
      }

      for (const locale of SEO_CONTENT_LOCALES) {
        if (entries.length >= MAX_SITEMAP_URLS) break;
        const translation = translations.get(locale);
        if (!translation) continue;
        entries.push({
          url: absolute(
            localizedMemePath(
              locale,
              meme.short_id,
              translation.localized_slug || meme.slug,
            ),
          ),
          ...lastModified(validDate(translation.updated_at)),
          changeFrequency: "weekly",
          priority: 0.75,
          alternates: { languages },
        });
      }
    }
    if (data.length < PAGE) break;
  }

  const activeHomeLocales = SEO_CONTENT_LOCALES.filter(
    (locale) => (localizedHomeCounts.get(locale) ?? 0) > 0,
  );
  const rootLanguages = homeLanguages(activeHomeLocales);
  rootEntry.alternates = { languages: rootLanguages };
  entries.splice(
    1,
    0,
    ...activeHomeLocales.map((locale) => ({
      url: absolute(localizedPath("/", locale)),
      ...lastModified(localizedHomeLastModified.get(locale)),
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: { languages: rootLanguages },
    })),
  );

  const activeExploreLocales = SEO_CONTENT_LOCALES.filter(
    (locale) => (localizedExploreCounts.get(locale) ?? 0) >= MIN_LOCALIZED_EXPLORE_ITEMS,
  );
  if (activeExploreLocales.length > 0) {
    const languages = exploreLanguages(activeExploreLocales);
    const koreanExplore = entries.find((entry) => entry.url === `${SITE_URL}/explore`);
    if (koreanExplore) koreanExplore.alternates = { languages };
    entries.push(
      ...activeExploreLocales.map((locale) => ({
        url: absolute(localizedPath("/explore", locale)),
        ...lastModified(localizedExploreLastModified.get(locale)),
        changeFrequency: "daily" as const,
        priority: 0.65,
        alternates: { languages },
      })),
    );
  }

  return entries.slice(0, MAX_SITEMAP_URLS);
}
