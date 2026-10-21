import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublicMemeMedia } from "@/lib/sources/public-links.server";
import {
  resolveMemeDelivery,
  selectSecondaryReferenceContents,
} from "@/lib/meme-delivery";
import {
  resolveDisplayCategory,
  shortIdFromParam,
  type LifecycleStatus,
  type SafetyLevel,
} from "@/lib/labels";
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
import { MemeMarketPassport } from "@/components/meme-market-passport";
import { MemeDetailNavigation } from "@/components/meme-detail-navigation";
import { MemeEmbed } from "@/components/meme-embed";
import { SaveButton } from "@/components/save-button";
import { ShareButton } from "@/components/share-button";
import {
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeWebPageJsonLd,
} from "@/components/json-ld";
import {
  getAvailableTranslationLocales,
  getLocalizedMemeByShortId,
  isIndexableLocalizedMeme,
  type LocalizedMemeDetail,
} from "@/lib/meme-translations";
import type { MemeContentRow, MemeSourceRow } from "@/lib/queries";
import { getMemeMarketPassport } from "@/lib/meme-market-passport.server";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";
import { publicSourceUrl } from "@/lib/source-links";
import { getPublicMemeProducedVideos } from "@/lib/video-production/public.server";
import { MemeProducedVideos } from "@/components/meme-produced-videos";
import {
  publicMemeEmbedContent,
  publicReaderDescription,
} from "@/lib/meme-public-detail";

export const revalidate = 600;

type Props = { params: Promise<{ locale: string; key: string }> };

type DetailCopy = {
  home: string;
  meaningTitle: string;
  originalTitle: string;
  originalMedia: string;
  referenceVideoTitle: string;
  referenceVideoBody: string;
  pageNavigation: string;
  storyNavigation: string;
  mediaNavigation: string;
  usageNavigation: string;
  sourcesNavigation: string;
  readerTools: string;
  moreDetails: string;
  marketDetails: string;
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
  lifecycle: Record<LifecycleStatus, string>;
};

const DETAIL_COPY: Record<SeoContentLocale, DetailCopy> = {
  en: {
    home: "Korean meme dictionary",
    meaningTitle: "Meaning",
    originalTitle: "Original Korean title",
    originalMedia: "Original media",
    referenceVideoTitle: "Reviewed reference videos",
    referenceVideoBody: "These videos are supplementary context to aid understanding, not evidence of the challenge's origin or independent spread.",
    pageNavigation: "On this page",
    storyNavigation: "Meaning and origin",
    mediaNavigation: "Original media",
    usageNavigation: "How to use it",
    sourcesNavigation: "Sources",
    readerTools: "Reader tools",
    moreDetails: "Meaning and origin",
    marketDetails: "Regional context",
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
    lifecycle: { rising: "Rising", active: "Trending", cooling: "Cooling down", archived: "Archive" },
  },
  ja: {
    home: "韓国ミーム辞典",
    meaningTitle: "意味",
    originalTitle: "韓国語の原題",
    originalMedia: "元のメディア",
    referenceVideoTitle: "確認済みの参考動画",
    referenceVideoBody: "理解を助ける補助資料であり、チャレンジの起源や独立した拡散の根拠ではありません。",
    pageNavigation: "このページの内容",
    storyNavigation: "意味と由来",
    mediaNavigation: "元のメディア",
    usageNavigation: "使い方",
    sourcesNavigation: "出典",
    readerTools: "活用ツール",
    moreDetails: "意味と由来",
    marketDetails: "地域別の情報",
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
    lifecycle: { rising: "急上昇", active: "流行中", cooling: "落ち着き中", archived: "過去のミーム" },
  },
  zh: {
    home: "韩国迷因词典",
    meaningTitle: "含义",
    originalTitle: "韩文原名",
    originalMedia: "原始内容",
    referenceVideoTitle: "已审核的参考视频",
    referenceVideoBody: "这些视频是帮助理解的补充资料，并非挑战起源或独立传播的依据。",
    pageNavigation: "本页内容",
    storyNavigation: "含义与来源",
    mediaNavigation: "原始内容",
    usageNavigation: "使用方法",
    sourcesNavigation: "来源",
    readerTools: "使用工具",
    moreDetails: "含义与来源",
    marketDetails: "地区传播信息",
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
    lifecycle: { rising: "正在上升", active: "正在流行", cooling: "热度下降", archived: "经典迷因" },
  },
  "zh-tw": {
    home: "韓國迷因辭典",
    meaningTitle: "含義",
    originalTitle: "韓文原名",
    originalMedia: "原始內容",
    referenceVideoTitle: "已審核的參考影片",
    referenceVideoBody: "這些影片是幫助理解的補充資料，並非挑戰起源或獨立傳播的依據。",
    pageNavigation: "本頁內容",
    storyNavigation: "含義與來源",
    mediaNavigation: "原始內容",
    usageNavigation: "使用方式",
    sourcesNavigation: "來源",
    readerTools: "應用工具",
    moreDetails: "含義與來源",
    marketDetails: "地區傳播資訊",
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
    lifecycle: { rising: "正在上升", active: "正在流行", cooling: "熱度下降", archived: "經典迷因" },
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

type PublicLocalizedDelivery = {
  readonly originalSources: readonly MemeSourceRow[];
  readonly renderableContents: readonly MemeContentRow[];
};

/** Keep translation review/freshness gates while scoring only publicly deliverable media. */
function isIndexableLocalizedDelivery(
  meme: LocalizedMemeDetail,
  delivery: PublicLocalizedDelivery,
): boolean {
  return isIndexableLocalizedMeme({
    ...meme,
    description: publicReaderDescription(meme.description),
    meme_sources: [...delivery.originalSources],
    meme_contents: [...delivery.renderableContents],
  });
}

const getLanguageVersions = cache(async function getLanguageVersions(
  shortId: string,
  memeId: string,
  current: SeoContentLocale,
) {
  const available = await getAvailableTranslationLocales(memeId);
  const locales = [...new Set([current, ...available.filter(isSeoContentLocale)])];
  const translated = await Promise.all(
    locales.map(async (locale) => ({ locale, meme: await getLocalizedMemeByShortId(shortId, locale) })),
  );
  return translated.filter(
    (item): item is { locale: SeoContentLocale; meme: NonNullable<typeof item.meme> } =>
      item.meme !== null,
  );
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, key } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  const shortId = shortIdFromParam(key);
  const meme = await getLocalizedMemeByShortId(shortId, locale);
  if (!meme) notFound();
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale,
  });
  if (redirectPath) redirect(redirectPath);

  const [versions, publicMedia] = await Promise.all([
    getLanguageVersions(shortId, meme.id, locale),
    getPublicMemeMedia(meme.meme_sources, meme.meme_contents),
  ]);
  const delivery = resolveMemeDelivery({
    contents: publicMedia.contents,
    sources: publicMedia.sources,
  });
  const isPageIndexable = isIndexableLocalizedDelivery(meme, delivery);
  const indexableVersions = versions.filter(({ meme: version }) =>
    isIndexableLocalizedDelivery(version, delivery),
  );
  const copy = DETAIL_COPY[locale];
  const canonical = localizedMemePath(locale, meme.short_id, meme.slug);
  const koreanPath = localizedMemePath("ko", meme.short_id, meme.original.slug);
  const languages = Object.fromEntries([
    ["ko", koreanPath],
    ...indexableVersions.map(({ locale: versionLocale, meme: version }) => [
      getHreflang(versionLocale),
      localizedMemePath(versionLocale, version.short_id, version.slug),
    ]),
    ["x-default", koreanPath],
  ]);
  const description = `${meme.title}: ${meme.summary}`;
  const metadata = buildLocalizedMetadata({
    locale,
    pathname: canonical,
    title: `${meme.title} · ${copy.meaningTitle}`,
    description,
  });

  return {
    ...metadata,
    alternates: {
      canonical,
      ...(isPageIndexable ? { languages } : {}),
    },
    ...(isPageIndexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
      locale: getOpenGraphLocale(locale),
      alternateLocale: isPageIndexable
        ? indexableVersions
            .filter((item) => item.locale !== locale)
            .map((item) => getOpenGraphLocale(item.locale))
        : [],
    },
  };
}

export default async function LocalizedMemePage({ params }: Props) {
  const { locale, key } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const shortId = shortIdFromParam(key);
  const meme = await getLocalizedMemeByShortId(shortId, locale);
  if (!meme) notFound();
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale,
  });
  if (redirectPath) redirect(redirectPath);

  const [versions, marketPassport, producedVideos, publicMedia] = await Promise.all([
    getLanguageVersions(shortId, meme.id, locale),
    getMemeMarketPassport(meme.id, locale),
    getPublicMemeProducedVideos(meme.id),
    getPublicMemeMedia(meme.meme_sources, meme.meme_contents),
  ]);
  const copy = DETAIL_COPY[locale];
  const config = SEO_LOCALE_CONFIG[locale];
  const seo = getSeoCopy(locale);
  const canonical = localizedMemePath(locale, meme.short_id, meme.slug);
  const delivery = resolveMemeDelivery({
    contents: publicMedia.contents,
    sources: publicMedia.sources,
  });
  const secondaryReferenceContents = selectSecondaryReferenceContents({
    memeId: meme.id,
    contents: delivery.renderableContents,
    sources: delivery.originalSources,
    representative: delivery.representative,
  });
  const isPageIndexable = isIndexableLocalizedDelivery(meme, delivery);
  const sourceLinks = delivery.originalSources.flatMap((source) => {
    const url = publicSourceUrl(source.source_url);
    return url ? [{ ...source, source_url: url }] : [];
  });
  const allContexts = usageContexts(meme.usage_context);
  const contextsUnverified = isUnverifiedContexts(allContexts);
  const contexts = contextsUnverified ? [] : allContexts;
  const isMachine = meme.translation.status === "machine";
  const isStale = meme.translation.status === "stale" || !meme.translation.isCurrent;
  const needsReview = !isPageIndexable;
  const readerDescription = publicReaderDescription(meme.description);
  const hasMarketPassport =
    marketPassport.dataStatus === "unavailable" ||
    marketPassport.profiles.length > 0 ||
    marketPassport.variants.length > 0;
  const detailNavigationItems = [
    { id: "meme-media", label: copy.mediaNavigation },
    ...(meme.usage_note
      ? [{ id: "meme-usage", label: copy.usageNavigation }]
      : []),
    ...((readerDescription || meme.origin)
      ? [{ id: "meme-story", label: copy.storyNavigation }]
      : []),
    ...(sourceLinks.length > 0
      ? [{ id: "meme-sources", label: copy.sourcesNavigation }]
      : []),
  ];

  return (
    <article
      lang={config.documentLanguage}
      dir={config.direction}
      className="mx-auto max-w-6xl px-4 py-8 pb-20 text-foreground sm:px-6 lg:py-12"
    >
      {!needsReview && (
        <>
          <MemeWebPageJsonLd
            locale={locale}
            path={canonical}
            name={meme.title}
            summary={meme.summary}
            description={readerDescription}
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
        <Link href={localizedPath("/", locale)} className="underline-offset-4 hover:text-foreground hover:underline">
          {copy.home}
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <Link href={localizedPath(`/explore?category=${resolveDisplayCategory(meme.category)}`, locale)} className="underline-offset-4 hover:text-foreground hover:underline">
          {seo.categories[meme.category]}
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

      <header className="rounded-2xl border border-border border-s-4 border-s-accent bg-surface-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-muted">
            {copy.lifecycle[meme.lifecycle_status]}
          </span>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-text">
            {copy.safety[meme.safety_level]}
          </span>
        </div>
        <h1 className="mt-3 max-w-4xl break-words text-3xl font-black leading-tight tracking-[-0.02em] text-balance sm:text-4xl">
          {meme.title}
        </h1>
        {meme.original.title !== meme.title && (
          <p className="mt-1 text-sm text-muted">
            {copy.originalTitle}: <span lang="ko" dir="ltr">{meme.original.title}</span>
          </p>
        )}
        <p id="meme-summary" className="mt-3 max-w-[65ch] break-words text-lg font-medium leading-7 text-pretty">
          {meme.summary}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {meme.origin_year && <span>{copy.born(meme.origin_year)}</span>}
            <span>
              {copy.updated}: {new Intl.DateTimeFormat(config.dateLocale, { dateStyle: "long" }).format(new Date(meme.translation.updatedAt))}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <SaveButton memeId={meme.id} compact />
            {!needsReview && (
              <ShareButton
                path={canonical}
                title={meme.title}
                label={copy.share}
                copiedLabel={copy.shareCopied}
                copiedStatus={copy.shareCopiedStatus}
                siteName={seo.siteName}
              />
            )}
          </div>
        </div>
      </header>

      <div className="mt-5">
        <MemeDetailNavigation
          label={copy.pageNavigation}
          items={detailNavigationItems}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start lg:gap-10">
        <section
          id="meme-media"
          aria-labelledby="meme-media-title"
          className="min-w-0 scroll-mt-28 space-y-4"
        >
          <h2 id="meme-media-title" className="text-xl font-black tracking-[-0.01em]">
            {copy.originalMedia}
          </h2>
          <MemeEmbed
            content={publicMemeEmbedContent(delivery.representative)}
            fallbackSourceUrl={delivery.fallbackSourceUrl}
            fallbackReason={delivery.fallbackReason}
            title={meme.title}
            isRepresentative={delivery.representative?.is_representative ?? true}
            category={meme.category}
            originYear={meme.origin_year}
          />
          {secondaryReferenceContents.length > 0 && (
            <section aria-labelledby="secondary-reference-title" className="border-t border-border pt-4">
              <h2 id="secondary-reference-title" className="text-lg font-bold">{copy.referenceVideoTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{copy.referenceVideoBody}</p>
              <div className="mt-3 grid gap-4">
                {secondaryReferenceContents.map((content) => (
                  <MemeEmbed
                    key={content.id}
                    content={publicMemeEmbedContent(content)}
                    title={meme.title}
                    isRepresentative={false}
                  />
                ))}
              </div>
            </section>
          )}
          <MemeProducedVideos videos={producedVideos} memeTitle={meme.title}
            structuredDataPath={isPageIndexable ? canonical : undefined} />
        </section>

        <div className="min-w-0 space-y-6">
          {meme.usage_note && (
            <section id="meme-usage" aria-labelledby="meme-usage-title" className="scroll-mt-28 border-b border-border pb-6">
              <h2 id="meme-usage-title" className="text-lg font-bold">{copy.usage}</h2>
              <p className="mt-2 max-w-[65ch] whitespace-pre-line break-words text-sm leading-7">{meme.usage_note}</p>
              {(contextsUnverified || contexts.length > 0) && (
                <details className="mt-3 border-t border-border">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-offset-4">
                    {copy.context}
                  </summary>
                  {contextsUnverified ? (
                    <p className="pb-3 text-sm text-muted">{copy.contextUnverified}</p>
                  ) : (
                    <dl className="grid gap-2 pb-3">
                      {contexts.map(([context, level]) => (
                        <div key={context} className="flex items-center justify-between gap-3 text-sm">
                          <dt>{copy.contexts[context] ?? context}</dt>
                          <dd className="font-semibold">{copy.safety[level]}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </details>
              )}
            </section>
          )}
          {(readerDescription || meme.origin) && (
            <details
              id="meme-story"
              open
              tabIndex={-1}
              className="scroll-mt-28 border-y border-border"
            >
              <summary className="min-h-12 cursor-pointer py-4 text-lg font-bold focus-visible:outline-offset-4">
                {copy.moreDetails}
              </summary>
              <div className="max-w-[65ch] space-y-6 pb-6 text-sm leading-7">
                {readerDescription && (
                  <section aria-labelledby="meme-description">
                    <h2 id="meme-description" className="font-bold">{copy.description}</h2>
                    <p className="mt-2 whitespace-pre-line break-words text-muted">{readerDescription}</p>
                  </section>
                )}
                {meme.origin && (
                  <section aria-labelledby="meme-origin">
                    <h2 id="meme-origin" className="font-bold">{copy.origin}</h2>
                    <p className="mt-2 whitespace-pre-line break-words text-muted">{meme.origin}</p>
                  </section>
                )}
              </div>
            </details>
          )}
          {meme.caution && (
            <section aria-labelledby="meme-caution" className="rounded-xl border border-safety-yellow/40 bg-safety-yellow-bg/50 p-4 text-safety-yellow">
              <h2 id="meme-caution" className="font-bold">{copy.caution}</h2>
              <p className="mt-2 max-w-[65ch] whitespace-pre-line break-words text-sm leading-7">{meme.caution}</p>
            </section>
          )}
        </div>
      </div>

      <details className="mt-6 border-t border-border">
        <summary className="min-h-11 cursor-pointer py-4 font-semibold focus-visible:outline-offset-4">
          {copy.language}
        </summary>
        <nav aria-label={copy.language} className="pb-4">
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
      </details>

      {sourceLinks.length > 0 && (
        <details id="meme-sources" open className="scroll-mt-28 border-t border-border">
          <summary className="min-h-11 cursor-pointer py-4 font-semibold focus-visible:outline-offset-4">
            {copy.sources}
          </summary>
          <ol className="space-y-3 pb-4">
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
        </details>
      )}

      {hasMarketPassport && (
        <details className="border-t border-border">
          <summary className="min-h-11 cursor-pointer py-4 font-semibold focus-visible:outline-offset-4">
            {copy.marketDetails}
          </summary>
          <div className="pb-4">
            <MemeMarketPassport passport={marketPassport} locale={locale} />
          </div>
        </details>
      )}
    </article>
  );
}
