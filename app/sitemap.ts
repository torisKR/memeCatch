import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";
import {
  isIndexableLocalizedMeme,
  isTranslationCurrent,
  type LocalizedMeme,
  type TranslationStatus,
} from "@/lib/meme-translations";
import { koreanRankingsVisible } from "@/lib/korean-rankings.server";
import { evidenceTimestamp } from "@/lib/source-links";
import {
  SEO_CONTENT_LOCALES,
  SEO_ROUTE_LOCALES,
  isSeoContentLocale,
  localizedMemePath,
  localizedPath,
  toHrefLang,
  type SeoContentLocale,
} from "@/lib/i18n-routing";


import { CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";

/**
 * A database-less image build must not cache a sitemap that has no meme URLs.
 * `revalidate` still prerenders that empty result into the standalone server.
 * `force-dynamic` keeps the first request live. The module cache below skips
 * the full catalog scan for the next hour, and next.config sets
 * `s-maxage` plus `stale-while-revalidate` on `/sitemap.xml`. An outage is
 * not cached, so the next request tries the catalog again.
 */
export const dynamic = "force-dynamic";

const SITEMAP_CACHE_MS = 60 * 60 * 1000;

type CachedSitemap = {
  expiresAt: number;
  entries: MetadataRoute.Sitemap;
  koreanMemeCount: number;
};

let cachedSitemap: CachedSitemap | null = null;

export function clearSitemapCache(): void {
  cachedSitemap = null;
}

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
  "short_id, slug, updated_at, description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status)," +
  " meme_tags_map(tag_id)," +
  " meme_translations(locale, status, localized_slug, source_updated_at, updated_at, title, summary, description, origin)";

type SitemapTimestamp = string | Date;

type SitemapTranslationRow = {
  locale: string;
  status: string;
  localized_slug: string;
  source_updated_at: SitemapTimestamp;
  updated_at: SitemapTimestamp;
  title: string;
  summary: string;
  description: string;
  origin: string;
};

type SitemapMemeRow = ContentDepthInput & {
  short_id: string;
  slug: string;
  updated_at: SitemapTimestamp;
  meme_translations: SitemapTranslationRow[];
};

function validDate(value: SitemapTimestamp | null | undefined): Date | undefined {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return undefined;
    return evidenceTimestamp(value.toISOString()) ? new Date(value.getTime()) : undefined;
  }
  const timestamp = evidenceTimestamp(value);
  return timestamp ? new Date(timestamp) : undefined;
}

function lastModified(date: Date | undefined): { lastModified: Date } | Record<string, never> {
  return date ? { lastModified: date } : {};
}

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
    // 해외 주 타깃 전환: 언어 미상 방문자는 영어 홈으로 보낸다.
    "x-default": absolute(localizedPath("/", "en")),
  };
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
    "x-default": absolute(localizedPath("/pricing", "en")),
  };
}

function exploreLanguages(locales: readonly SeoContentLocale[]): Record<string, string> {
  const languages: Record<string, string> = {
    ko: absolute("/explore"),
  };
  for (const locale of locales) {
    languages[toHrefLang(locale)] = absolute(localizedPath("/explore", locale));
  }
  return { ...languages, "x-default": languages.en ?? languages.ko };
}

function translationStatus(status: string): TranslationStatus | null {
  if (status === "machine" || status === "reviewed" || status === "stale") return status;
  return null;
}

/** Same slug the detail page publishes: trim, then fall back to the Korean slug. */
function publishedLocalizedSlug(
  localizedSlug: string | null | undefined,
  sourceSlug: string,
): string {
  const trimmed = localizedSlug?.trim() ?? "";
  return trimmed || sourceSlug;
}

function timestampText(value: SitemapTimestamp): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Crawl targets use the detail page's publication predicate.
 * `isIndexableLocalizedMeme` checks reviewed status, required prose,
 * `isIndexableMeme` on the Korean source, and `isTranslationCurrent`.
 * Freshness goes through `sameInstant`, which treats a node-pg Date and a
 * microsecond `row_to_json` string of the same millisecond as one revision.
 */
function localizedIndexCandidate(
  meme: SitemapMemeRow,
  translation: SitemapTranslationRow,
  locale: SeoContentLocale,
  status: TranslationStatus,
): LocalizedMeme {
  return {
    id: meme.short_id,
    short_id: meme.short_id,
    updated_at: timestampText(meme.updated_at),
    slug: publishedLocalizedSlug(translation.localized_slug, meme.slug),
    title: translation.title,
    summary: translation.summary,
    description: translation.description,
    origin: translation.origin,
    usage_note: null,
    caution: null,
    aliases: [],
    usage_examples: meme.usage_examples,
    meme_sources: meme.meme_sources,
    meme_contents: meme.meme_contents,
    meme_tags_map: meme.meme_tags_map,
    original: {
      slug: meme.slug,
      title: "",
      summary: "",
      description: meme.description ?? "",
      origin: meme.origin ?? "",
      usage_note: meme.usage_note ?? null,
      caution: meme.caution ?? null,
      aliases: [],
      usage_examples: meme.usage_examples,
    },
    translation: {
      locale,
      status,
      localizedSlug: translation.localized_slug?.trim() || null,
      sourceUpdatedAt: timestampText(translation.source_updated_at),
      updatedAt: timestampText(translation.updated_at),
      isCurrent: isTranslationCurrent(translation.source_updated_at, meme.updated_at),
      provider: "",
      model: "",
      promptVersion: 0,
      translatedAt: timestampText(translation.updated_at),
      reviewedAt: null,
    },
  };
}

/** Only reviewed, current, complete translations may become crawl targets. */
function reviewedTranslations(meme: SitemapMemeRow): Map<SeoContentLocale, SitemapTranslationRow> {
  const translations = new Map<SeoContentLocale, SitemapTranslationRow>();
  for (const translation of meme.meme_translations ?? []) {
    if (!isSeoContentLocale(translation.locale)) continue;
    const status = translationStatus(translation.status);
    if (!status) continue;
    if (!isIndexableLocalizedMeme(localizedIndexCandidate(meme, translation, translation.locale, status))) {
      continue;
    }
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
        publishedLocalizedSlug(translation.localized_slug, meme.slug),
      ),
    );
  }
  // 해외 주 타깃 전환: x-default는 영어 문서. reviewed en 번역이 없으면 ko 원문 유지
  // (존재하지 않는 /en URL을 가리키면 유해).
  return { ...languages, "x-default": languages.en ?? absolute(koreanPath) };
}

function reportCatalogUnavailable(): void {
  // 오류 원문에는 쿼터 문구와 요청 URL이 섞인다. 빌드를 멈추는 대신 정적 URL만 남긴다.
  console.error("[sitemap] catalog unavailable");
}

async function buildSitemap(): Promise<{
  entries: MetadataRoute.Sitemap;
  catalogUnavailable: boolean;
  koreanMemeCount: number;
}> {
  // 홈·탐색은 새 공개 문서가 실제로 노출면을 바꾸므로 최신 공개일을 쓸 수 있다.
  // 데이터가 없으면 요청/빌드 시각을 발명하지 않고 lastModified를 생략한다.
  // 카탈로그가 402처럼 막혀도 정적 페이지 사이트맵은 빌드를 통과해야 한다.
  let supabase: ReturnType<typeof createStaticClient> | null = null;
  let homeLastMod: Date | undefined;
  let catalogUnavailable = false;
  try {
    supabase = createStaticClient();
    const { data: latest, error } = await supabase
      .from("memes")
      .select("published_at")
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      reportCatalogUnavailable();
      catalogUnavailable = true;
    } else {
      homeLastMod = validDate(latest?.published_at);
    }
  } catch {
    reportCatalogUnavailable();
    catalogUnavailable = true;
  }

  const showRankings = await koreanRankingsVisible();

  const localizedHomeEntries: MetadataRoute.Sitemap = SEO_CONTENT_LOCALES.map(
    (locale) => ({
      url: absolute(localizedPath("/", locale)),
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: { languages: homeLanguages() },
    }),
  );
  const localizedPricingEntries: MetadataRoute.Sitemap = SEO_CONTENT_LOCALES.map(
    (locale) => ({
      url: absolute(localizedPath("/pricing", locale)),
      changeFrequency: "weekly" as const,
      priority: 0.55,
      alternates: { languages: pricingLanguages() },
    }),
  );
  const localizedHomeLastModified = new Map<SeoContentLocale, Date>();
  const localizedExploreCounts = new Map<SeoContentLocale, number>();

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      ...lastModified(homeLastMod),
      changeFrequency: "hourly",
      priority: 1,
      alternates: { languages: homeLanguages() },
    },
    ...localizedHomeEntries,
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
    ...(["/global", "/studio", "/timeline", "/slang", "/quiz", "/weekly", "/rankings", "/community", "/news", "/about", "/editorial", "/privacy", "/terms", "/contact"] as const)
      .filter((path) => showRankings || path !== "/rankings")
      .map((path) => ({
        url: `${SITE_URL}${path}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
  ];

  // 공개 밈 중 **콘텐츠가 충실한 것만** 색인 노출한다.
  // 공개(approved + limited) 전량을 제출하면 정의 130~150자짜리 얇은 문서가
  // 사이트맵의 대부분을 차지해 대량생산 얇은 콘텐츠로 평가된다(애드센스 거부 사유).
  // 얇은 밈의 상세 페이지는 그대로 200으로 살아 있고 noindex,follow만 붙는다 —
  // 데이터는 삭제하지 않으며 사이트맵에서 발견 경로만 뺀다.
  // 페이지 단위로 순회 — 사이트맵 상한 5만 URL.
  const PAGE = 1000;
  let koreanMemeCount = 0;
  for (let from = 0; !catalogUnavailable && supabase && from < 49000; from += PAGE) {
    let data: unknown[] | null = null;
    try {
      const page = await supabase
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
      if (page.error) {
        reportCatalogUnavailable();
        catalogUnavailable = true;
        break;
      }
      data = page.data;
    } catch {
      reportCatalogUnavailable();
      catalogUnavailable = true;
      break;
    }
    if (!data || data.length === 0) break;

    for (const meme of data as unknown as SitemapMemeRow[]) {
      if (CANONICAL_MEME_ALIAS_MAP[meme.short_id]) continue;
      if (!isIndexableMeme(meme)) continue;
      const translations = reviewedTranslations(meme);
      const languages = memeLanguages(meme, translations);
      for (const [locale, translation] of translations) {
        localizedExploreCounts.set(
          locale,
          (localizedExploreCounts.get(locale) ?? 0) + 1,
        );
        const translationUpdatedAt = validDate(translation.updated_at);
        const currentLatest = localizedHomeLastModified.get(locale);
        if (
          translationUpdatedAt &&
          (!currentLatest || translationUpdatedAt > currentLatest)
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
        koreanMemeCount += 1;
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
              publishedLocalizedSlug(translation.localized_slug, meme.slug),
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

  for (const [index, locale] of SEO_CONTENT_LOCALES.entries()) {
    localizedHomeEntries[index].lastModified = localizedHomeLastModified.get(locale);
  }

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
        ...lastModified(localizedHomeLastModified.get(locale)),
        changeFrequency: "daily" as const,
        priority: 0.65,
        alternates: { languages },
      })),
    );
  }

  return {
    entries: entries.slice(0, MAX_SITEMAP_URLS),
    catalogUnavailable,
    koreanMemeCount,
  };
}

async function loadSitemap(): Promise<{
  entries: MetadataRoute.Sitemap;
  koreanMemeCount: number | null;
}> {
  const now = Date.now();
  if (cachedSitemap && cachedSitemap.expiresAt > now) return cachedSitemap;
  const built = await buildSitemap();
  if (!built.catalogUnavailable) {
    cachedSitemap = {
      expiresAt: now + SITEMAP_CACHE_MS,
      entries: built.entries,
      koreanMemeCount: built.koreanMemeCount,
    };
    return cachedSitemap;
  }
  return { entries: built.entries, koreanMemeCount: null };
}

/** Indexable unprefixed meme URLs. Null when the catalog read failed. */
export async function getIndexableKoreanMemeCount(): Promise<number | null> {
  return (await loadSitemap()).koreanMemeCount;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await loadSitemap()).entries;
}
