import {
  SEO_LOCALE_CONFIG,
  isSeoContentLocale,
  localizedMemePath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { getLocalizedFeaturedMemesResult } from "@/lib/meme-translations";
import { publicationExportUnavailableResponse } from "@/lib/publication-export";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import { parseUsageExamples } from "@/lib/usage-examples";
import { citableSources } from "@/lib/source-links";
import { publicationMarkdownText } from "@/lib/publication-markdown";

export const revalidate = 3600;

type Copy = {
  intro: string;
  policy: string;
  original: string;
  summary: string;
  description: string;
  origin: string;
  usage: string;
  caution: string;
  examples: string;
  sources: string;
  sourceCaveat: string;
  updated: string;
  attribution: string;
  noValue: string;
  contact: string;
  canonicalIndex: string;
  entries: string;
};

const COPY: Record<SeoContentLocale, Copy> = {
  en: {
    intro: "Full human-reviewed, current translation corpus for Korean meme retrieval and citation.",
    policy: "Machine translations, stale translations, incomplete Korean entries, and thin source records are excluded.",
    original: "Original Korean title",
    summary: "Summary",
    description: "Meaning",
    origin: "Origin",
    usage: "Usage",
    caution: "Caution",
    examples: "Usage examples",
    sources: "Sources",
    sourceCaveat: "Source links are references for checking the underlying material; their presence alone does not independently verify an origin claim.",
    updated: "Translation updated",
    attribution: "For attribution, cite the localized entry URL and retain its Korean title. Use the listed source URLs to distinguish primary material from contextual references.",
    noValue: "Not specified",
    contact: "Contact",
    canonicalIndex: "Canonical index",
    entries: "Entries",
  },
  ja: {
    intro: "韓国ミームの検索・引用向けに、人が確認し、原文と同期した翻訳全文を収録しています。",
    policy: "機械翻訳、古い翻訳、不完全な韓国語記事、出典の薄い記事は除外しています。",
    original: "韓国語の原題",
    summary: "要約",
    description: "意味",
    origin: "由来",
    usage: "使い方",
    caution: "注意点",
    examples: "使用例",
    sources: "出典",
    sourceCaveat: "出典リンクは原資料を確認するための参考です。リンクがあるだけで由来の説明が独立して検証済みになるわけではありません。",
    updated: "翻訳更新日",
    attribution: "引用時は各言語の記事URLを示し、韓国語の原題も残してください。掲載した出典URLで一次資料と文脈資料を区別してください。",
    noValue: "記載なし",
    contact: "問い合わせ",
    canonicalIndex: "正規索引",
    entries: "収録件数",
  },
  zh: {
    intro: "面向韩国迷因检索与引用的完整语料，仅收录人工审核且与原文同步的翻译。",
    policy: "机器翻译、过期翻译、内容不完整的韩文词条和来源薄弱的记录均不收录。",
    original: "韩文原名",
    summary: "摘要",
    description: "含义",
    origin: "起源",
    usage: "用法",
    caution: "注意事项",
    examples: "使用示例",
    sources: "来源",
    sourceCaveat: "来源链接用于核对原始材料；仅有链接并不代表起源说法已经得到独立验证。",
    updated: "翻译更新时间",
    attribution: "引用时请使用对应语言的词条 URL，并保留韩文原名。请通过列出的来源 URL 区分一手资料与背景参考。",
    noValue: "未注明",
    contact: "联系",
    canonicalIndex: "规范索引",
    entries: "词条数",
  },
  "zh-tw": {
    intro: "供韓國迷因檢索與引用使用的完整語料，只收錄人工審核且與原文同步的翻譯。",
    policy: "機器翻譯、過期翻譯、內容不完整的韓文詞條和來源薄弱的紀錄均不收錄。",
    original: "韓文原名",
    summary: "摘要",
    description: "含義",
    origin: "起源",
    usage: "用法",
    caution: "注意事項",
    examples: "使用範例",
    sources: "來源",
    sourceCaveat: "來源連結用於核對原始材料；僅有連結並不代表起源說法已獲獨立驗證。",
    updated: "翻譯更新時間",
    attribution: "引用時請使用對應語言的詞條 URL，並保留韓文原名。請透過列出的來源 URL 區分第一手資料與背景參考。",
    noValue: "未註明",
    contact: "聯絡",
    canonicalIndex: "標準索引",
    entries: "詞條數",
  },
};

function prose(value: string | null | undefined, fallback: string) {
  const safe = publicationMarkdownText(value);
  return safe || publicationMarkdownText(fallback);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return new Response("Not found\n", { status: 404 });

  const [result, copy] = await Promise.all([
    getLocalizedFeaturedMemesResult(locale, 400, "approved-only"),
    Promise.resolve(COPY[locale]),
  ]);
  if (result.status === "unavailable") {
    return publicationExportUnavailableResponse();
  }
  const memes = result.items;
  const entries = memes.map((meme) => {
    const url = `${SITE_URL}${localizedMemePath(locale, meme.short_id, meme.slug)}`;
    const sources = citableSources(meme.meme_sources)
      .map(
        (source) =>
          `- [${prose(source.title, copy.sources)}](${source.url})${source.publisher ? ` — ${prose(source.publisher, copy.sources)}` : ""}`,
      )
      .join("\n");
    const examples = parseUsageExamples(meme.usage_examples)
      .map(
        (example) =>
          `- ${prose(example.situation, copy.noValue)}: ${prose(example.text, copy.noValue)}`,
      )
      .join("\n");

    return `## ${prose(meme.title, copy.noValue)}
URL: ${url}
${copy.original}: ${prose(meme.original.title, copy.noValue)}
${copy.summary}: ${prose(meme.summary, copy.noValue)}

### ${copy.description}
${prose(meme.description, copy.noValue)}

### ${copy.origin}
${prose(meme.origin, copy.noValue)}

### ${copy.usage}
${prose(meme.usage_note, copy.noValue)}

### ${copy.caution}
${prose(meme.caution, copy.noValue)}

### ${copy.examples}
${examples || `- ${copy.noValue}`}

### ${copy.sources}
${sources || `- ${copy.noValue}`}
${copy.sourceCaveat}

${copy.updated}: ${publicationMarkdownText(meme.translation.updatedAt)}`;
  });

  const body = `# MemeCatch — llms-full (${locale})

> ${copy.intro}
>
> ${copy.policy}

${copy.attribution}
${copy.contact}: ${CONTACT_EMAIL}
${copy.canonicalIndex}: ${SITE_URL}/${locale}/llms.txt
${copy.entries}: ${memes.length}

${entries.join("\n\n---\n\n")}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": SEO_LOCALE_CONFIG[locale].bcp47,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
