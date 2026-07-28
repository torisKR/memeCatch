import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SEO_LOCALE_CONFIG,
  getSeoCopy,
  isSeoContentLocale,
  localizedMemePath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { getLocalizedFeaturedMemes } from "@/lib/meme-translations";
import { SITE_URL } from "@/lib/site";

export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

type LandingCopy = {
  eyebrow: string;
  desk: string;
  title: string;
  intro: string;
  primaryCta: string;
  explainerTitle: string;
  explainerBody: string;
  meaning: string;
  origin: string;
  safety: string;
  meaningBody: string;
  originBody: string;
  safetyBody: string;
  featured: string;
  featuredIntro: string;
  read: string;
  original: string;
  empty: string;
  methodTitle: string;
  methodBody: string;
};

const LANDING_COPY: Record<SeoContentLocale, LandingCopy> = {
  en: {
    eyebrow: "Korean internet culture, with context",
    desk: "Translation desk",
    title: "Korean memes should not need an inside connection.",
    intro:
      "MemeCatch translates the joke and the cultural footnotes: what a Korean meme means, where it started, and when using it might land badly.",
    primaryCta: "Start with a translated meme",
    explainerTitle: "More than a literal translation",
    explainerBody:
      "Korean memes travel through TV clips, livestreams, fandoms, group chats, and comment sections. We preserve the Korean name while explaining the context that a dictionary translation misses.",
    meaning: "Meaning",
    origin: "Origin",
    safety: "Usage signal",
    meaningBody: "The joke in plain language, without assuming you already know the reference.",
    originBody: "The clip, phrase, community, or moment that made it recognizable in Korea.",
    safetyBody: "Whether it is current, dated, context-sensitive, or risky to repeat.",
    featured: "Translated Korean memes",
    featuredIntro: "Only current, human-reviewed translations are published. Machine and outdated drafts stay private until an editor approves them.",
    read: "Read the explanation",
    original: "Korean title",
    empty: "Reviewed translations are being prepared. Please check back soon.",
    methodTitle: "Built for readers—and answer engines",
    methodBody:
      "Every reviewed entry is server-rendered with its sources, dates, Korean original, language-specific metadata, and structured data. That makes the explanation readable without JavaScript and attributable when search or AI systems cite it.",
  },
  ja: {
    eyebrow: "文脈までわかる韓国インターネット文化",
    desk: "翻訳デスク",
    title: "韓国ミームを、内輪ネタのままにしない。",
    intro:
      "MemeCatchは、韓国ミームの意味だけでなく、どこから生まれ、今どんな場面で使えるのかまで翻訳して解説します。",
    primaryCta: "翻訳されたミームを見る",
    explainerTitle: "直訳だけでは伝わらないもの",
    explainerBody:
      "韓国ミームはテレビ、配信、ファンダム、グループチャット、コメント欄を行き来します。韓国語の原題を残し、辞書だけではわからない背景を説明します。",
    meaning: "意味",
    origin: "由来",
    safety: "使用シグナル",
    meaningBody: "元ネタを知らなくても理解できる言葉で、笑いどころを説明します。",
    originBody: "韓国で広まるきっかけになった映像、言葉、コミュニティ、出来事をたどります。",
    safetyBody: "今も使えるか、古い表現か、文脈への注意やリスクがあるかを示します。",
    featured: "翻訳済みの韓国ミーム",
    featuredIntro: "人が確認した最新の翻訳だけを公開します。機械翻訳や古い下書きは、編集者が承認するまで非公開です。",
    read: "解説を読む",
    original: "韓国語の原題",
    empty: "確認済みの翻訳を準備しています。しばらくしてからもう一度ご覧ください。",
    methodTitle: "読者にも検索・AIにも読みやすく",
    methodBody:
      "確認済みの記事は、出典、日付、韓国語の原題、言語別メタデータ、構造化データとともにサーバーで描画されます。JavaScriptなしでも読め、検索やAIが引用するときも出典をたどれます。",
  },
  zh: {
    eyebrow: "连语境一起读懂韩国网络文化",
    desk: "翻译台",
    title: "不用混进韩国人的圈子，也能看懂韩国迷因。",
    intro:
      "MemeCatch 不只翻译字面意思，还会说明韩国迷因从哪里来、笑点是什么，以及现在使用是否合适。",
    primaryCta: "查看已翻译迷因",
    explainerTitle: "不止是直译",
    explainerBody:
      "韩国迷因在电视片段、直播、粉丝圈、群聊和评论区之间传播。我们保留韩文原名，并补上词典翻译容易遗漏的文化背景。",
    meaning: "含义",
    origin: "起源",
    safety: "使用提示",
    meaningBody: "即使不知道原梗，也能用清楚的语言理解笑点。",
    originBody: "追溯让它在韩国变得家喻户晓的片段、说法、社群或事件。",
    safetyBody: "说明它是否仍流行、是否过时、需要注意语境，或不宜随便使用。",
    featured: "已翻译的韩国迷因",
    featuredIntro: "只发布经过人工审核且内容最新的翻译；机器翻译和过期草稿在编辑批准前不会公开。",
    read: "阅读解释",
    original: "韩文原名",
    empty: "审核过的翻译正在准备中，请稍后再来。",
    methodTitle: "让读者、搜索和 AI 都能理解",
    methodBody:
      "每篇审核过的词条都会在服务器端输出来源、日期、韩文原名、多语言元数据和结构化数据。即使没有 JavaScript 也能阅读，搜索或 AI 引用时也能追溯出处。",
  },
  "zh-tw": {
    eyebrow: "連語境一起讀懂韓國網路文化",
    desk: "翻譯台",
    title: "不用混進韓國人的圈子，也能看懂韓國迷因。",
    intro:
      "MemeCatch 不只翻譯字面意思，還會說明韓國迷因從哪裡來、笑點是什麼，以及現在使用是否合適。",
    primaryCta: "查看已翻譯迷因",
    explainerTitle: "不只是直譯",
    explainerBody:
      "韓國迷因在電視片段、直播、粉絲圈、群組聊天和留言區之間流傳。我們保留韓文原名，並補上字典翻譯容易遺漏的文化背景。",
    meaning: "含義",
    origin: "起源",
    safety: "使用提示",
    meaningBody: "即使不知道原梗，也能用清楚的文字理解笑點。",
    originBody: "追溯讓它在韓國廣為人知的片段、說法、社群或事件。",
    safetyBody: "說明它是否仍流行、是否過時、需要注意語境，或不宜隨便使用。",
    featured: "已翻譯的韓國迷因",
    featuredIntro: "只發布經過人工審核且內容最新的翻譯；機器翻譯和過期草稿在編輯核准前不會公開。",
    read: "閱讀解釋",
    original: "韓文原名",
    empty: "審核過的翻譯正在準備中，請稍後再來。",
    methodTitle: "讓讀者、搜尋和 AI 都能理解",
    methodBody:
      "每篇審核過的詞條都會在伺服器端輸出來源、日期、韓文原名、多語言中繼資料和結構化資料。即使沒有 JavaScript 也能閱讀，搜尋或 AI 引用時也能追溯出處。",
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

export default async function LocalizedHomePage({ params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const [featured, copy] = await Promise.all([
    getLocalizedFeaturedMemes(locale, 12),
    Promise.resolve(LANDING_COPY[locale]),
  ]);
  const config = SEO_LOCALE_CONFIG[locale];
  const seo = getSeoCopy(locale);
  const firstHref = featured[0]
    ? localizedMemePath(locale, featured[0].short_id, featured[0].slug)
    : null;

  return (
    <main
      lang={config.documentLanguage}
      dir={config.direction}
      className="relative isolate overflow-hidden bg-background pb-16 text-foreground"
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/${locale}#website`,
              name: seo.siteName,
              url: `${SITE_URL}/${locale}`,
              description: seo.description,
              inLanguage: config.bcp47,
              publisher: { "@id": `${SITE_URL}#org` },
            },
            {
              "@type": "DefinedTermSet",
              "@id": `${SITE_URL}/${locale}#glossary`,
              name: seo.glossaryName,
              description: seo.glossaryDescription,
              url: `${SITE_URL}/${locale}`,
              inLanguage: config.bcp47,
            },
          ],
        }}
      />

      <section className="relative border-b border-border px-4 py-16 sm:py-24">
        <div
          aria-hidden
          lang="ko"
          className="pointer-events-none absolute -right-8 -top-16 select-none text-[16rem] font-black leading-none text-accent opacity-[0.07] sm:right-[8%] sm:text-[24rem]"
        >
          밈
        </div>
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {copy.eyebrow}
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.06] tracking-[-0.035em] sm:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            {copy.intro}
          </p>
          {firstHref && (
            <Link
              href={firstHref}
              className="mt-8 inline-flex min-h-12 items-center rounded-full bg-accent-strong px-6 font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {copy.primaryCta} <span aria-hidden className="ml-2">→</span>
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <section aria-labelledby="translation-desk" className="py-14 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_1.4fr] lg:gap-14">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-accent">
                {copy.desk}
              </p>
              <h2 id="translation-desk" className="mt-3 text-3xl font-black tracking-tight">
                {copy.explainerTitle}
              </h2>
              <p className="mt-4 leading-relaxed text-muted">{copy.explainerBody}</p>
            </div>
            <dl className="grid divide-y divide-border border-y border-border">
              {[
                [copy.meaning, copy.meaningBody],
                [copy.origin, copy.originBody],
                [copy.safety, copy.safetyBody],
              ].map(([term, description]) => (
                <div key={term} className="grid gap-1 py-5 sm:grid-cols-[8rem_1fr] sm:gap-5">
                  <dt className="font-bold text-foreground">{term}</dt>
                  <dd className="text-muted">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="featured-memes" className="border-t border-border py-14 sm:py-20">
          <div className="max-w-3xl">
            <h2 id="featured-memes" className="text-3xl font-black tracking-tight">
              {copy.featured}
            </h2>
            <p className="mt-3 leading-relaxed text-muted">{copy.featuredIntro}</p>
          </div>

          {featured.length > 0 ? (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((meme) => (
                <li key={meme.id}>
                  <Link
                    href={localizedMemePath(locale, meme.short_id, meme.slug)}
                    className="group flex h-full min-h-56 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                      {seo.categories[meme.category]}
                    </span>
                    <h3 className="mt-3 text-xl font-black leading-snug tracking-tight group-hover:text-accent">
                      {meme.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                      {meme.summary}
                    </p>
                    <span className="mt-auto pt-6 text-sm font-bold">
                      {copy.read} <span aria-hidden>→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 rounded-2xl border border-border bg-surface p-6 text-muted">
              {copy.empty}
            </p>
          )}
        </section>

        <aside className="rounded-3xl border border-border bg-surface-2 p-6 sm:p-9">
          <h2 className="text-2xl font-black tracking-tight">{copy.methodTitle}</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">{copy.methodBody}</p>
          <p className="mt-5 font-mono text-xs text-muted">
            <a className="underline underline-offset-4 hover:text-foreground" href={`/${locale}/llms.txt`}>
              llms.txt
            </a>
            <span aria-hidden> · </span>
            <a className="underline underline-offset-4 hover:text-foreground" href={`/${locale}/llms-full.txt`}>
              llms-full.txt
            </a>
          </p>
        </aside>
      </div>
    </main>
  );
}
