import {
  SEO_LOCALE_CONFIG,
  getSeoCopy,
  isSeoContentLocale,
  localizedMemePath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { getLocalizedFeaturedMemes } from "@/lib/meme-translations";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";

export const revalidate = 3600;

type Copy = {
  summary: string;
  editorial: string;
  entryPoints: string;
  home: string;
  full: string;
  koreanSite: string;
  featured: string;
  empty: string;
  citation: string;
  citationRules: string[];
  contact: string;
};

const COPY: Record<SeoContentLocale, Copy> = {
  en: {
    summary: "A multilingual guide to Korean meme terms, challenge dances, songs, drama scenes, and meme videos, explaining meaning, origin, usage, and cultural risk.",
    editorial: "Indexable translations are human-reviewed, current with the Korean source, and backed by substantial source material. Machine and outdated drafts are visible to readers but excluded from search and AI discovery feeds.",
    entryPoints: "Key entry points",
    home: "Korean meme dictionary",
    full: "Full translated corpus for AI systems",
    koreanSite: "Korean source site",
    featured: "Featured reviewed translations",
    empty: "No reviewed translations are available yet.",
    citation: "Citation and attribution",
    citationRules: ["Cite the localized meme page URL, not this index.", "Keep the original Korean title when identifying a meme.", "Follow the source links on each entry for primary or contextual evidence."],
    contact: "Corrections and removal requests",
  },
  ja: {
    summary: "韓国のミーム用語、チャレンジダンス、楽曲、ドラマシーン、ミーム動画の意味・由来・使い方・文化的な注意点を多言語で解説する辞典です。",
    editorial: "検索登録される翻訳は、人が確認し、韓国語の原文と同期し、十分な出典を持つものに限ります。機械翻訳や古い下書きは読者向けに表示しても、検索・AI向けフィードからは除外します。",
    entryPoints: "主な入口",
    home: "韓国ミーム辞典",
    full: "AI向け翻訳全文コーパス",
    koreanSite: "韓国語の原文サイト",
    featured: "注目の確認済み翻訳",
    empty: "確認済みの翻訳はまだありません。",
    citation: "引用と出典表記",
    citationRules: ["この索引ではなく、各言語のミーム記事URLを引用してください。", "ミームを特定するときは韓国語の原題も残してください。", "一次情報・文脈資料は各記事の出典リンクで確認してください。"],
    contact: "訂正・削除依頼",
  },
  zh: {
    summary: "以多语言解释韩国梗语、舞蹈挑战、歌曲、电视剧场景和梗视频的含义、起源、用法与文化风险。",
    editorial: "只有经过人工审核、与韩文原文同步且来源资料充足的翻译才会被收录。机器翻译和过期草稿可以供读者查看，但不会进入搜索和 AI 发现源。",
    entryPoints: "主要入口",
    home: "韩国迷因词典",
    full: "面向 AI 系统的完整翻译语料",
    koreanSite: "韩文原文网站",
    featured: "精选审核翻译",
    empty: "目前还没有审核过的翻译。",
    citation: "引用与署名",
    citationRules: ["请引用对应语言的迷因详情页，而不是本索引。", "识别迷因时请保留韩文原名。", "请通过每篇词条的来源链接核对一手资料或背景依据。"],
    contact: "更正与删除请求",
  },
  "zh-tw": {
    summary: "以多語言解釋韓國梗語、舞蹈挑戰、歌曲、電視劇場景和梗影片的含義、起源、用法與文化風險。",
    editorial: "只有經過人工審核、與韓文原文同步且來源資料充足的翻譯才會被收錄。機器翻譯和過期草稿可以供讀者查看，但不會進入搜尋和 AI 探索來源。",
    entryPoints: "主要入口",
    home: "韓國迷因辭典",
    full: "供 AI 系統使用的完整翻譯語料",
    koreanSite: "韓文原文網站",
    featured: "精選審核翻譯",
    empty: "目前還沒有審核過的翻譯。",
    citation: "引用與署名",
    citationRules: ["請引用對應語言的迷因詳細頁，而不是本索引。", "辨識迷因時請保留韓文原名。", "請透過每篇詞條的來源連結核對第一手資料或背景依據。"],
    contact: "更正與移除請求",
  },
};

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return new Response("Not found\n", { status: 404 });

  const [featured, copy] = await Promise.all([
    getLocalizedFeaturedMemes(locale, 15),
    Promise.resolve(COPY[locale]),
  ]);
  const seo = getSeoCopy(locale);
  const featuredBlock = featured.length
    ? featured
        .map(
          (meme) =>
            `- [${singleLine(meme.title)}](${SITE_URL}${localizedMemePath(locale, meme.short_id, meme.slug)}): ${singleLine(meme.summary)}`,
        )
        .join("\n")
    : `- (${copy.empty})`;

  const body = `# ${seo.siteName}

> ${copy.summary}
>
> ${copy.editorial}

## ${copy.entryPoints}
- [${copy.home}](${SITE_URL}/${locale})
- [${copy.full}](${SITE_URL}/${locale}/llms-full.txt)
- [${copy.koreanSite}](${SITE_URL})

## ${copy.featured}
${featuredBlock}

## ${copy.citation}
${copy.citationRules.map((rule) => `- ${rule}`).join("\n")}
- ${copy.contact}: ${CONTACT_EMAIL}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": SEO_LOCALE_CONFIG[locale].bcp47,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
