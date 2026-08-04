import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";
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

/**
 * 충실도 판정에 필요한 신호까지 함께 실어 온다.
 * 상세 페이지의 robots 판정(app/(default)/memes/[key]/page.tsx)과 **같은 신호**를 넘겨야
 * "사이트맵엔 있는데 noindex" 같은 모순이 생기지 않는다. 신호를 하나 빼면
 * 그 밈은 점수가 낮게 나와 조용히 색인에서 빠지므로 컬럼 변경 시 양쪽을 함께 본다.
 */
const DEPTH_SELECT =
  "short_id, slug, updated_at, description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url), meme_contents(availability, moderation_status)," +
  " meme_tags_map(tag_id)," +
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

type SitemapMemeRow = ContentDepthInput & {
  short_id: string;
  slug: string;
  updated_at: string;
  meme_translations: SitemapTranslationRow[];
};

function absolute(pathname: string): string {
  return `${SITE_URL}${pathname === "/" ? "" : pathname}`;
}

function homeLanguages(): Record<string, string> {
  return {
    ...Object.fromEntries(
      SEO_ROUTE_LOCALES.map((locale) => [
        toHrefLang(locale),
        absolute(localizedPath("/", locale)),
      ]),
    ),
    // 해외 주 타깃 전환(루프 048): 글로벌 기본 착지는 영어 홈.
    "x-default": absolute(localizedPath("/", "en")),
  };
}

/** Only reviewed, exact-source, complete translations may become crawl targets. */
function reviewedTranslations(meme: SitemapMemeRow): Map<SeoContentLocale, SitemapTranslationRow> {
  const translations = new Map<SeoContentLocale, SitemapTranslationRow>();
  for (const translation of meme.meme_translations ?? []) {
    if (!isSeoContentLocale(translation.locale)) continue;
    const isReviewedAndCurrent =
      translation.status === "reviewed" &&
      translation.source_updated_at === meme.updated_at &&
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
    "x-default": absolute(koreanPath),
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
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticClient();

  // 홈 lastmod — 빌드 시각(new Date) 대신 실제 콘텐츠 변경 시점(최신 밈 공개일)
  let homeLastMod = new Date();
  try {
    const { data: latest } = await supabase
      .from("memes")
      .select("published_at")
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();
    if (latest?.published_at) homeLastMod = new Date(latest.published_at);
  } catch {
    /* 실패 시 현재 시각 유지 */
  }

  const localizedHomeEntries: MetadataRoute.Sitemap = SEO_CONTENT_LOCALES.map(
    (locale) => ({
      url: absolute(localizedPath("/", locale)),
      lastModified: homeLastMod,
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: { languages: homeLanguages() },
    }),
  );
  const localizedHomeLastModified = new Map<SeoContentLocale, Date>();

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: homeLastMod,
      changeFrequency: "hourly",
      priority: 1,
      alternates: { languages: homeLanguages() },
    },
    ...localizedHomeEntries,
    {
      url: `${SITE_URL}/collections`,
      lastModified: homeLastMod,
      changeFrequency: "daily" as const,
      priority: 0.75,
    },
    // 테마별 모음 허브
    ...COLLECTIONS.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      lastModified: homeLastMod,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // 주요 정적 페이지 — 탐색·커뮤니티·정책
    ...(["/explore", "/timeline", "/slang", "/quiz", "/weekly", "/rankings", "/community", "/news", "/products", "/about", "/editorial", "/privacy", "/terms"] as const).map(
      (path) => ({
        url: `${SITE_URL}${path}`,
        lastModified: homeLastMod,
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

    // 조회 실패를 조용히 삼키면 사이트맵이 정적 페이지 25개짜리로 쪼그라든 채
    // 그대로 배포된다(밈 URL 0개). 색인 노출면 자체가 사라지는 사고라 로그를 남긴다.
    // 제어 흐름은 그대로 — 부분 사이트맵이 예외로 페이지 전체를 죽이는 것보다 낫다.
    if (error) {
      console.error(`[sitemap] 밈 조회 실패 (from=${from}):`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const meme of data as unknown as SitemapMemeRow[]) {
      if (!isIndexableMeme(meme)) continue;
      const translations = reviewedTranslations(meme);
      const languages = memeLanguages(meme, translations);
      for (const [locale, translation] of translations) {
        const translationUpdatedAt = new Date(translation.updated_at);
        const currentLatest = localizedHomeLastModified.get(locale);
        if (
          !Number.isNaN(translationUpdatedAt.getTime()) &&
          (!currentLatest || translationUpdatedAt > currentLatest)
        ) {
          localizedHomeLastModified.set(locale, translationUpdatedAt);
        }
      }

      if (entries.length < MAX_SITEMAP_URLS) {
        entries.push({
          url: `${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}`,
          lastModified: new Date(meme.updated_at),
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
          lastModified: new Date(translation.updated_at),
          changeFrequency: "weekly",
          priority: 0.75,
          alternates: { languages },
        });
      }
    }
    if (data.length < PAGE) break;
  }

  for (const [index, locale] of SEO_CONTENT_LOCALES.entries()) {
    localizedHomeEntries[index].lastModified =
      localizedHomeLastModified.get(locale) ?? homeLastMod;
  }

  return entries.slice(0, MAX_SITEMAP_URLS);
}
