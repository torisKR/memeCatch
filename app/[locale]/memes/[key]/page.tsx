import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import {
  getAvailableTranslationLocales,
  getLocalizedMemeByShortId,
  isIndexableLocalizedMeme,
} from "@/lib/meme-translations";
import { SITE_URL } from "@/lib/site";

export const revalidate = 600;

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
  machineTitle: string;
  machineBody: string;
  staleTitle: string;
  staleBody: string;
  incompleteTitle: string;
  incompleteBody: string;
  context: string;
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
    machineTitle: "Machine-translated draft",
    machineBody: "This translation is visible for reference, but it has not been reviewed by an editor and is not indexed by search engines.",
    staleTitle: "Translation needs an update",
    staleBody: "The Korean source changed after this translation was prepared. This version remains visible for reference but is not indexed.",
    incompleteTitle: "Source review is still in progress",
    incompleteBody: "This translation is current, but the underlying Korean entry does not yet meet the source and depth requirements for search indexing.",
    context: "By context",
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
    machineTitle: "機械翻訳の下書き",
    machineBody: "参考用に公開していますが、編集者による確認前のため、検索エンジンには登録されません。",
    staleTitle: "翻訳の更新が必要です",
    staleBody: "翻訳後に韓国語の原文が更新されました。参考用に表示しますが、検索エンジンには登録されません。",
    incompleteTitle: "出典の確認を続けています",
    incompleteBody: "翻訳は最新ですが、韓国語の記事が検索登録に必要な出典・内容量の基準をまだ満たしていません。",
    context: "場面別",
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
    machineTitle: "机器翻译草稿",
    machineBody: "此翻译仅供参考，尚未经过编辑审核，因此不会被搜索引擎收录。",
    staleTitle: "翻译需要更新",
    staleBody: "韩文原文在本翻译完成后发生了变化。此版本仍可参考，但不会被搜索引擎收录。",
    incompleteTitle: "来源仍在审核中",
    incompleteBody: "翻译是最新的，但韩文词条尚未达到搜索收录所需的来源与内容深度标准。",
    context: "不同场景",
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
    machineTitle: "機器翻譯草稿",
    machineBody: "此翻譯僅供參考，尚未經過編輯審核，因此不會被搜尋引擎收錄。",
    staleTitle: "翻譯需要更新",
    staleBody: "韓文原文在本翻譯完成後有所變動。此版本仍可參考，但不會被搜尋引擎收錄。",
    incompleteTitle: "來源仍在審核中",
    incompleteBody: "翻譯是最新的，但韓文詞條尚未達到搜尋收錄所需的來源與內容深度標準。",
    context: "不同情境",
    contexts: { work: "職場", friends: "朋友之間", family: "與家人", sns: "公開社群平台" },
    safety: { green: "通常可以使用", yellow: "需要注意語境", gray: "大多已經過時", red: "使用風險較高" },
  },
};

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function usageContexts(value: unknown): [string, SafetyLevel][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).filter(
    (entry): entry is [string, SafetyLevel] =>
      ["green", "yellow", "gray", "red"].includes(String(entry[1])),
  );
}

async function getLanguageVersions(shortId: string, memeId: string, current: SeoContentLocale) {
  const available = await getAvailableTranslationLocales(memeId);
  const locales = [...new Set([current, ...available.filter(isSeoContentLocale)])];
  const translated = await Promise.all(
    locales.map(async (locale) => ({ locale, meme: await getLocalizedMemeByShortId(shortId, locale) })),
  );
  return translated.filter(
    (item): item is { locale: SeoContentLocale; meme: NonNullable<typeof item.meme> } =>
      item.meme !== null,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, key } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  const shortId = shortIdFromParam(key);
  const meme = await getLocalizedMemeByShortId(shortId, locale);
  if (!meme) return { title: DETAIL_COPY[locale].meaningTitle, robots: { index: false, follow: false } };

  const versions = await getLanguageVersions(shortId, meme.id, locale);
  const indexableVersions = versions.filter(({ meme: version }) =>
    isIndexableLocalizedMeme(version),
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
    title: `${meme.title} — ${copy.meaningTitle}`,
    description,
  });

  return {
    ...metadata,
    alternates: { canonical, languages },
    ...(isIndexableLocalizedMeme(meme) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
      locale: getOpenGraphLocale(locale),
      alternateLocale: indexableVersions
        .filter((item) => item.locale !== locale)
        .map((item) => getOpenGraphLocale(item.locale)),
    },
  };
}

export default async function LocalizedMemePage({ params }: Props) {
  const { locale, key } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const shortId = shortIdFromParam(key);
  const meme = await getLocalizedMemeByShortId(shortId, locale);
  if (!meme) notFound();

  const versions = await getLanguageVersions(shortId, meme.id, locale);
  const copy = DETAIL_COPY[locale];
  const config = SEO_LOCALE_CONFIG[locale];
  const seo = getSeoCopy(locale);
  const canonical = localizedMemePath(locale, meme.short_id, meme.slug);
  const sourceLinks = meme.meme_sources.filter((source) => source.source_url);
  const contexts = usageContexts(meme.usage_context);
  const isMachine = meme.translation.status === "machine";
  const isStale = meme.translation.status === "stale" || !meme.translation.isCurrent;
  const needsReview = !isIndexableLocalizedMeme(meme);
  const datePublished = meme.published_at ?? meme.created_at;

  return (
    <article
      lang={config.documentLanguage}
      dir={config.direction}
      className="mx-auto max-w-5xl px-4 py-8 pb-16 text-foreground"
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${SITE_URL}${canonical}#webpage`,
              url: `${SITE_URL}${canonical}`,
              name: meme.title,
              description: meme.summary,
              inLanguage: config.bcp47,
              datePublished,
              dateModified: meme.translation.updatedAt,
              publisher: { "@id": `${SITE_URL}#org` },
              speakable: {
                "@type": "SpeakableSpecification",
                cssSelector: ["h1", "#meme-summary"],
              },
              mainEntity: { "@id": `${SITE_URL}${canonical}#term` },
            },
            {
              "@type": "DefinedTerm",
              "@id": `${SITE_URL}${canonical}#term`,
              name: meme.title,
              alternateName: meme.original.title,
              description: meme.description || meme.summary,
              url: `${SITE_URL}${canonical}`,
              inLanguage: config.bcp47,
              inDefinedTermSet: {
                "@type": "DefinedTermSet",
                "@id": `${SITE_URL}/${locale}#glossary`,
                name: seo.glossaryName,
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: copy.home, item: `${SITE_URL}${localizedPath("/", locale)}` },
                { "@type": "ListItem", position: 2, name: meme.title, item: `${SITE_URL}${canonical}` },
              ],
            },
          ],
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
        <Link href={localizedPath("/", locale)} className="underline-offset-4 hover:text-foreground hover:underline">
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
        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-[-0.03em] sm:text-6xl">
          {meme.title}
        </h1>
        <div className="mt-4 border-l-2 border-accent pl-4">
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
                {contexts.length > 0 && (
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
                    href={source.source_url!}
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
