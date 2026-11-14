import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { shortIdFromParam, type SafetyLevel } from "@/lib/labels";
import {
  SEO_LOCALE_CONFIG,
  buildLocalizedMetadata,
  getHreflang,
  getOpenGraphLocale,
  getSeoCopy,
  isSeoContentLocale,
  localizedMemePath,
  localizedPath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { localeMemeShareImage } from "@/lib/meme-share-image";
import { isOgPageLocale, ogPageContentLocale } from "@/lib/og-default-image";
import { MemeUseKit, MemeUseKitEntry } from "@/components/premium/meme-use-kit";
import { MemeTrendPanel } from "@/components/premium/meme-trend-panel";
import { ExportButton } from "@/components/export-button";
import { TranslationPriorityButton } from "@/components/premium/translation-priority-button";
import { MemeMarketPassport } from "@/components/meme-market-passport";
import { RelatedMemes } from "@/components/related-memes";
import { selectLocalizedRelatedCards } from "@/lib/localized-related";
import { SaveButton } from "@/components/save-button";
import { ShareButton } from "@/components/share-button";
import {
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeWebPageJsonLd,
} from "@/components/json-ld";
import { MemeCatalogUnavailable } from "@/components/meme-catalog-unavailable";
import {
  getAvailableTranslationLocales,
  getLocalizedMemeByShortId,
  getLocalizedSearchMemesResult,
  isIndexableLocalizedMeme,
  type LocalizedMemeDetail,
} from "@/lib/meme-translations";
import { unavailableMemeMetadata } from "@/lib/public-meme-document";
import { getRelatedMemes, MemeCatalogUnavailableError } from "@/lib/queries";
import { getMemeMarketPassport } from "@/lib/meme-market-passport.server";
import { canonicalMemeRedirectPath, CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";
import { isPublicDisplaySource, publicSourceUrl } from "@/lib/source-links";
import titleStyles from "@/components/meme-detail-title.module.css";

/** 한국어 상세와 같다. ISR로 두면 프로덕션 상세가 DYNAMIC_SERVER_USAGE 500이 된다. */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; key: string }> };

type DetailCopy = {
  home: string;
  meaningTitle: string;
  summary: string;
  originalTitle: string;
  description: string;
  origin: string;
  usage: string;
  caution: string;
  sources: string;
  sourceFallback: string;
  updated: string;
  born: (year: number) => string;
  language: string;
  korean: string;
  reviewed: string;
  share: string;
  shareCopied: string;
  shareCopiedStatus: string;
  machineTitle: string;
  machineBody: string;
  staleTitle: string;
  staleBody: string;
  incompleteTitle: string;
  incompleteBody: string;
  context: string;
  contextUnverified: string;
  contexts: Record<string, string>;
  safety: Record<SafetyLevel, string>;
};

const DETAIL_COPY: Record<SeoContentLocale, DetailCopy> = {
  en: {
    home: "Korean meme dictionary",
    meaningTitle: "Meaning",
    summary: "In one line",
    originalTitle: "Original Korean title",
    description: "What does it mean?",
    origin: "Where did it start?",
    usage: "How is it used?",
    caution: "What should I be careful about?",
    sources: "Sources and context",
    sourceFallback: "Open original source",
    updated: "Last updated",
    born: (year) => `Originated around ${year}`,
    language: "Available languages",
    korean: "Korean original",
    reviewed: "Human-reviewed translation",
    share: "Share",
    shareCopied: "Link copied!",
    shareCopiedStatus: "Link copied.",
    machineTitle: "Machine-translated draft",
    machineBody: "This translation is visible for reference, but it has not been reviewed by an editor and is not indexed by search engines.",
    staleTitle: "Translation needs an update",
    staleBody: "The Korean source changed after this translation was prepared. This version remains visible for reference but is not indexed.",
    incompleteTitle: "Source review is still in progress",
    incompleteBody: "This translation is current, but the underlying Korean entry does not yet meet the source and depth requirements for search indexing.",
    context: "By context",
    contextUnverified: "Ratings by context haven't been confirmed yet.",
    contexts: { work: "At work", friends: "With friends", family: "With family", sns: "On public social media" },
    safety: { green: "Generally safe to use", yellow: "Context matters", gray: "Mostly dated", red: "Risky to use" },
  },
  ja: {
    home: "韓国ミーム辞典",
    meaningTitle: "意味",
    summary: "ひとことで",
    originalTitle: "韓国語の原題",
    description: "どういう意味？",
    origin: "どこから始まった？",
    usage: "どう使う？",
    caution: "何に注意する？",
    sources: "出典と参考資料",
    sourceFallback: "元の出典を開く",
    updated: "最終更新",
    born: (year) => `${year}年ごろに登場`,
    language: "ほかの言語",
    korean: "韓国語の原文",
    reviewed: "人が確認した翻訳",
    share: "共有",
    shareCopied: "リンクをコピーしました！",
    shareCopiedStatus: "リンクをコピーしました。",
    machineTitle: "機械翻訳の下書き",
    machineBody: "参考用に公開していますが、編集者による確認前のため、検索エンジンには登録されません。",
    staleTitle: "翻訳の更新が必要です",
    staleBody: "翻訳後に韓国語の原文が更新されました。参考用に表示しますが、検索エンジンには登録されません。",
    incompleteTitle: "出典の確認を続けています",
    incompleteBody: "翻訳は最新ですが、韓国語の記事が検索登録に必要な出典・内容量の基準をまだ満たしていません。",
    context: "場面別",
    contextUnverified: "場面別の判定はまだ確認前です。",
    contexts: { work: "職場で", friends: "友人同士で", family: "家族と", sns: "公開SNSで" },
    safety: { green: "基本的に使用可", yellow: "文脈に注意", gray: "やや古い表現", red: "使用は危険" },
  },
  zh: {
    home: "韩国迷因词典",
    meaningTitle: "含义",
    summary: "一句话解释",
    originalTitle: "韩文原名",
    description: "是什么意思？",
    origin: "从哪里开始？",
    usage: "怎么使用？",
    caution: "需要注意什么？",
    sources: "来源与背景资料",
    sourceFallback: "打开原始来源",
    updated: "最后更新",
    born: (year) => `约在${year}年出现`,
    language: "其他语言",
    korean: "韩文原文",
    reviewed: "人工审核翻译",
    share: "分享",
    shareCopied: "链接已复制！",
    shareCopiedStatus: "链接已复制。",
    machineTitle: "机器翻译草稿",
    machineBody: "此翻译仅供参考，尚未经过编辑审核，因此不会被搜索引擎收录。",
    staleTitle: "翻译需要更新",
    staleBody: "韩文原文在本翻译完成后发生了变化。此版本仍可参考，但不会被搜索引擎收录。",
    incompleteTitle: "来源仍在审核中",
    incompleteBody: "翻译是最新的，但韩文词条尚未达到搜索收录所需的来源与内容深度标准。",
    context: "不同场景",
    contextUnverified: "各场景的判定尚未经过确认。",
    contexts: { work: "职场", friends: "朋友之间", family: "与家人", sns: "公开社交平台" },
    safety: { green: "通常可以使用", yellow: "需要注意语境", gray: "大多已经过时", red: "使用风险较高" },
  },
  "zh-tw": {
    home: "韓國迷因辭典",
    meaningTitle: "含義",
    summary: "一句話解釋",
    originalTitle: "韓文原名",
    description: "是什麼意思？",
    origin: "從哪裡開始？",
    usage: "怎麼使用？",
    caution: "需要注意什麼？",
    sources: "來源與背景資料",
    sourceFallback: "開啟原始來源",
    updated: "最後更新",
    born: (year) => `約在${year}年出現`,
    language: "其他語言",
    korean: "韓文原文",
    reviewed: "人工審核翻譯",
    share: "分享",
    shareCopied: "連結已複製！",
    shareCopiedStatus: "連結已複製。",
    machineTitle: "機器翻譯草稿",
    machineBody: "此翻譯僅供參考，尚未經過編輯審核，因此不會被搜尋引擎收錄。",
    staleTitle: "翻譯需要更新",
    staleBody: "韓文原文在本翻譯完成後有所變動。此版本仍可參考，但不會被搜尋引擎收錄。",
    incompleteTitle: "來源仍在審核中",
    incompleteBody: "翻譯是最新的，但韓文詞條尚未達到搜尋收錄所需的來源與內容深度標準。",
    context: "不同情境",
    contextUnverified: "各情境的判定尚未經過確認。",
    contexts: { work: "職場", friends: "朋友之間", family: "與家人", sns: "公開社群平台" },
    safety: { green: "通常可以使用", yellow: "需要注意語境", gray: "大多已經過時", red: "使用風險較高" },
  },
};

function usageContexts(value: unknown): [string, SafetyLevel][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).filter(
    (entry): entry is [string, SafetyLevel] =>
      ["green", "yellow", "gray", "red"].includes(String(entry[1])),
  );
}

// KO 상세와 같은 규칙(components/usage-guide.tsx isUnverifiedUsageContext):
// 유효 칸 2개 이상이 전부 green이면 상황별 확인 흔적이 없는 것으로 본다.
// 로케일마다 다른 결론이 나오면 안 된다(HG-003 C안 §3.4).
function isUnverifiedContexts(entries: [string, SafetyLevel][]): boolean {
  return entries.length >= 2 && entries.every(([, level]) => level === "green");
}

async function getLanguageVersions(shortId: string, memeId: string, current: SeoContentLocale) {
  const available = await getAvailableTranslationLocales(memeId);
  const locales = [...new Set([current, ...available.filter(isSeoContentLocale)])];
  const translated = await Promise.all(
    locales.map(async (locale) => {
      try {
        return { locale, meme: await getLocalizedMemeByShortId(shortId, locale) };
      } catch (error) {
        if (!(error instanceof MemeCatalogUnavailableError)) throw error;
        return { locale, meme: null };
      }
    }),
  );
  return translated.filter(
    (item): item is { locale: SeoContentLocale; meme: NonNullable<typeof item.meme> } =>
      item.meme !== null,
  );
}

async function loadLocalizedDetail(
  shortId: string,
  locale: SeoContentLocale,
): Promise<{ status: "ready"; meme: LocalizedMemeDetail | null } | { status: "unavailable"; meme: null }> {
  try {
    return { status: "ready", meme: await getLocalizedMemeByShortId(shortId, locale) };
  } catch (error) {
    if (!(error instanceof MemeCatalogUnavailableError)) throw error;
    return { status: "unavailable", meme: null };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: shareLocale, key } = await params;
  if (!isOgPageLocale(shareLocale)) return { robots: { index: false, follow: false } };
  if (shareLocale === "ar") notFound();
  const locale = ogPageContentLocale(shareLocale);

  const requestedShortId = shortIdFromParam(key);
  const targetShortId = CANONICAL_MEME_ALIAS_MAP[requestedShortId] ?? requestedShortId;
  const loaded = await loadLocalizedDetail(targetShortId, locale);
  // Same as main: a catalog outage is the unavailable state, and a missing
  // translation is notFound. Do not substitute the Korean curated card.
  if (loaded.status === "unavailable") return unavailableMemeMetadata();
  const meme = loaded.meme;
  if (!meme) notFound();

  if (targetShortId !== requestedShortId) {
    permanentRedirect(localizedMemePath(shareLocale, meme.short_id, meme.slug));
  }
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale: shareLocale,
  });
  if (redirectPath) permanentRedirect(redirectPath);

  const versions = await getLanguageVersions(meme.short_id, meme.id, locale);
  const indexableVersions = versions.filter(({ meme: version }) =>
    isIndexableLocalizedMeme(version),
  );
  const copy = DETAIL_COPY[locale];
  const canonical = localizedMemePath(shareLocale, meme.short_id, meme.slug);
  const koreanPath = localizedMemePath("ko", meme.short_id, meme.original.slug);
  const englishVersion = indexableVersions.find(({ locale: versionLocale }) =>
    versionLocale === "en",
  )?.meme;
  const xDefault = englishVersion
    ? localizedMemePath("en", englishVersion.short_id, englishVersion.slug)
    : koreanPath;
  const languages = Object.fromEntries([
    ["ko", koreanPath],
    ...indexableVersions.map(({ locale: versionLocale, meme: version }) => [
      getHreflang(versionLocale),
      localizedMemePath(versionLocale, version.short_id, version.slug),
    ]),
    ["x-default", xDefault],
  ]);
  const description = `${meme.title}: ${meme.summary}`;
  const image = localeMemeShareImage({
    locale,
    shortId: meme.short_id,
    slug: meme.slug,
    alt: meme.title,
    version: meme.updated_at,
  });
  const metadata = buildLocalizedMetadata({
    locale: shareLocale,
    pathname: canonical,
    title: `${meme.title} · ${copy.meaningTitle}`,
    description,
  });

  return {
    ...metadata,
    alternates: { canonical, languages },
    ...(!isIndexableLocalizedMeme(meme)
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
      locale: getOpenGraphLocale(shareLocale),
      alternateLocale: indexableVersions
        .filter((item) => item.locale !== shareLocale)
        .map((item) => getOpenGraphLocale(item.locale)),
      images: [image],
    },
    twitter: {
      ...metadata.twitter,
      images: [image],
    },
  };
}

export default async function LocalizedMemePage({ params }: Props) {
  const { locale: shareLocale, key } = await params;
  if (!isOgPageLocale(shareLocale)) notFound();
  if (shareLocale === "ar") notFound();
  const locale = ogPageContentLocale(shareLocale);

  const requestedShortId = shortIdFromParam(key);
  const targetShortId = CANONICAL_MEME_ALIAS_MAP[requestedShortId] ?? requestedShortId;
  const loaded = await loadLocalizedDetail(targetShortId, locale);
  if (loaded.status === "unavailable") return <MemeCatalogUnavailable />;
  const meme = loaded.meme;
  if (!meme) notFound();

  if (targetShortId !== requestedShortId) {
    permanentRedirect(localizedMemePath(shareLocale, meme.short_id, meme.slug));
  }
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale: shareLocale,
  });
  if (redirectPath) permanentRedirect(redirectPath);

  const tagIds = meme.meme_tags_map.map((tag) => tag.tag_id);
  const [versions, marketPassport, related] = await Promise.all([
    getLanguageVersions(meme.short_id, meme.id, locale),
    getMemeMarketPassport(meme.id, locale),
    getRelatedMemes(
      { id: meme.id, category: meme.category, origin_year: meme.origin_year },
      tagIds,
      6,
    ),
  ]);
  const localizedRelated = await getLocalizedSearchMemesResult(
    related.map((item) => item.short_id),
    locale,
    { includeEmptySummary: true },
  );
  const relatedCards = selectLocalizedRelatedCards(related, localizedRelated.items, locale);
  const copy = DETAIL_COPY[locale];
  const config = SEO_LOCALE_CONFIG[locale];
  const seo = getSeoCopy(shareLocale);
  const canonical = localizedMemePath(shareLocale, meme.short_id, meme.slug);
  const sourceLinks = meme.meme_sources.flatMap((source) => {
    if (!isPublicDisplaySource(source)) return [];
    const url = publicSourceUrl(source.source_url);
    return url ? [{ ...source, source_url: url }] : [];
  });
  const allContexts = usageContexts(meme.usage_context);
  const contextsUnverified = isUnverifiedContexts(allContexts);
  const contexts = contextsUnverified ? [] : allContexts;
  const isMachine = meme.translation.status === "machine";
  const isStale = meme.translation.status === "stale" || !meme.translation.isCurrent;
  const needsReview = !isIndexableLocalizedMeme(meme);

  return (
    <article
      lang={config.documentLanguage}
      dir={config.direction}
      className="mx-auto max-w-5xl px-4 py-8 pb-16 text-foreground"
    >
      {!needsReview && (
        <>
          <MemeWebPageJsonLd
            locale={locale}
            path={canonical}
            name={meme.title}
            summary={meme.summary}
            description={meme.description}
            shortId={meme.short_id}
            slug={meme.slug}
            datePublished={meme.published_at}
            dateModified={meme.translation.updatedAt}
            sources={sourceLinks}
          />
          <MemeDefinedTermJsonLd
            locale={locale}
            path={canonical}
            name={meme.title}
            summary={meme.summary}
            shortId={meme.short_id}
            slug={meme.slug}
          />
        </>
      )}
      <MemeBreadcrumbJsonLd
        locale={locale}
        path={canonical}
        homeName={copy.home}
        categoryName={seo.categories[meme.category]}
        category={meme.category}
        name={meme.title}
        shortId={meme.short_id}
        slug={meme.slug}
      />

      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
        <Link href={localizedPath("/", shareLocale)} className="underline-offset-4 hover:text-foreground hover:underline">
          {copy.home}
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span aria-current="page">{meme.title}</span>
      </nav>

      {needsReview && (
        <aside className="mb-7 rounded-2xl border border-safety-yellow bg-safety-yellow-bg p-4 text-safety-yellow">
          <p className="font-bold">
            {isMachine
              ? copy.machineTitle
              : isStale
                ? copy.staleTitle
                : copy.incompleteTitle}
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            {isMachine
              ? copy.machineBody
              : isStale
                ? copy.staleBody
                : copy.incompleteBody}
          </p>
        </aside>
      )}

      <header className="border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]">
          <span className="rounded-full bg-accent-soft px-3 py-1.5 text-accent">{seo.categories[meme.category]}</span>
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-muted">{copy.safety[meme.safety_level]}</span>
          {!needsReview && <span className="rounded-full bg-safety-green-bg px-3 py-1.5 text-safety-green">{copy.reviewed}</span>}
        </div>
        <div className={titleStyles.frame}>
          <h1 className={`${titleStyles.title} mt-5 whitespace-normal font-black leading-tight tracking-[-0.03em]`}>
            {meme.title}
          </h1>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{copy.originalTitle}</p>
          <p lang="ko" dir="ltr" className="mt-1 text-lg font-bold">{meme.original.title}</p>
        </div>
        <p id="meme-summary" className="mt-6 max-w-3xl text-xl font-medium leading-relaxed">
          {meme.summary}
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {meme.origin_year && <span>{copy.born(meme.origin_year)}</span>}
          <span>
            {copy.updated}: {new Intl.DateTimeFormat(config.dateLocale, { dateStyle: "long" }).format(new Date(meme.translation.updatedAt))}
          </span>
        </p>
      </header>

      <nav aria-label={copy.language} className="border-b border-border py-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.language}</p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={localizedMemePath("ko", meme.short_id, meme.original.slug)}
              hrefLang="ko"
              lang="ko"
              className="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm font-semibold hover:border-accent"
            >
              {copy.korean}
            </Link>
          </li>
          {versions.map(({ locale: versionLocale, meme: version }) => (
            <li key={versionLocale}>
              <Link
                href={localizedMemePath(versionLocale, version.short_id, version.slug)}
                hrefLang={getHreflang(versionLocale)}
                aria-current={versionLocale === locale ? "page" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm font-semibold hover:border-accent aria-[current=page]:border-accent aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
              >
                {versionLocale === "zh-tw" ? "繁體中文" : versionLocale === "zh" ? "简体中文" : versionLocale === "ja" ? "日本語" : "English"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,15rem)] lg:items-start">
        <SaveButton memeId={meme.id} />
        <TranslationPriorityButton
          memeId={meme.id}
          locale={locale}
          translationStatus={meme.translation.status}
          translationIsCurrent={meme.translation.isCurrent}
        />
        <ExportButton shortId={meme.short_id} />
      </div>
      <div className="mt-3">
        <MemeUseKitEntry locale={locale} />
      </div>
      {!needsReview && (
        <div className="mt-3 flex justify-end">
          <ShareButton
            path={canonical}
            title={meme.title}
            label={copy.share}
            copiedLabel={copy.shareCopied}
            copiedStatus={copy.shareCopiedStatus}
            siteName={seo.siteName}
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="space-y-6">
          {meme.description && (
            <section aria-labelledby="meme-description" className="glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-7">
              {/* 계측 격자 — glass-panel과 같은 노드에 두면 배경 shorthand가 grid-line을
                  지우므로 별도 레이어로 둔다(status-panel.tsx 문법 재사용). 정적이라 성능 비용 없음. */}
              <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
              <div className="relative">
                <h2 id="meme-description" className="text-2xl font-black tracking-tight">{copy.description}</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed">{meme.description}</p>
              </div>
            </section>
          )}
          {meme.origin && (
            <section aria-labelledby="meme-origin" className="glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-7">
              <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
              <div className="relative">
                <h2 id="meme-origin" className="text-2xl font-black tracking-tight">{copy.origin}</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed">{meme.origin}</p>
              </div>
            </section>
          )}
          {meme.usage_note && (
            <section aria-labelledby="meme-usage" className="glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-7">
              <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
              <div className="relative">
                <h2 id="meme-usage" className="text-2xl font-black tracking-tight">{copy.usage}</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed">{meme.usage_note}</p>
                {contextsUnverified ? (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
                      <span aria-hidden>◌</span>
                      {copy.contextUnverified}
                    </p>
                  </div>
                ) : (
                  contexts.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <h3 className="text-sm font-bold">{copy.context}</h3>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        {contexts.map(([context, level]) => (
                          <div key={context} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                            <dt>{copy.contexts[context] ?? context}</dt>
                            <dd className="font-semibold">{copy.safety[level]}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )
                )}
              </div>
            </section>
          )}
          {meme.caution && (
            <section aria-labelledby="meme-caution" className="rounded-2xl border border-safety-yellow bg-safety-yellow-bg p-5 text-safety-yellow sm:p-7">
              <h2 id="meme-caution" className="text-xl font-black">{copy.caution}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{meme.caution}</p>
            </section>
          )}
          <MemeUseKit
            title={meme.title}
            summary={meme.summary}
            usageNote={meme.usage_note}
            caution={meme.caution}
            safetyLevel={meme.safety_level}
            lifecycleStatus={meme.lifecycle_status}
          />

          <MemeMarketPassport passport={marketPassport} locale={locale} />
          <MemeTrendPanel memeId={meme.id} />
          <RelatedMemes memes={relatedCards} locale={locale} />
        </div>

        {sourceLinks.length > 0 && (
          <aside className="rounded-2xl border border-border bg-surface-2 p-5 lg:sticky lg:top-20">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
              {copy.sources}
            </h2>
            <ol className="mt-4 space-y-3">
              {sourceLinks.map((source, index) => (
                <li key={source.id} className="text-sm">
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline decoration-border underline-offset-4 hover:text-accent"
                  >
                    {source.title || source.platform || `${copy.sourceFallback} ${index + 1}`}
                    <span aria-hidden> ↗</span>
                  </a>
                  {source.creator_name && <p className="mt-1 text-xs text-muted">{source.creator_name}</p>}
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </article>
  );
}
