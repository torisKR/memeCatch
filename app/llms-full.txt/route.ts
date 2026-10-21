import { createStaticClient } from "@/lib/supabase/server";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import {
  AI_MEME_DISPLAY_CATEGORY,
  DISPLAY_CATEGORY_LIST,
  SAFETY_LEVELS,
  memePathFrom,
  type MemeCategory,
  type SafetyLevel,
} from "@/lib/labels";
import { SEO_CONTENT_LOCALES } from "@/lib/i18n-routing";
import {
  loadApprovedIndexableMemes,
  publicationExportUnavailableResponse,
} from "@/lib/publication-export";
import type { ContentDepthInput } from "@/lib/content-depth";
import { parseUsageExamples } from "@/lib/usage-examples";
import { publicationMarkdownText } from "@/lib/publication-markdown";

/**
 * llms-full.txt — AI 시스템용 사이트 "전체 본문" (https://llmstxt.org 규격의 full 변형).
 * llms.txt가 요약 인덱스라면, 여기는 밈별 뜻·유래·사용 안전도까지 담은 완결 콘텐츠를 제공해
 * 답변엔진(ChatGPT/Perplexity 등)이 링크를 크롤링하지 않고도 정확히 인용할 수 있게 한다.
 * 크기 제어를 위해 최근 등록 순으로 상한을 둔다(전체 URL은 sitemap.xml로 안내).
 */
export const revalidate = 3600;

const MAX_MEMES = 400;

type Row = ContentDepthInput & {
  id: string;
  title: string;
  short_id: string;
  slug: string;
  summary: string;
  description: string | null;
  origin: string | null;
  origin_year: number | null;
  usage_note: string | null;
  aliases: string[] | null;
  category: MemeCategory;
  safety_level: SafetyLevel;
  published_at: string | null;
  moderation_status: "approved";
};

function oneLine(v: string | null | undefined): string {
  return publicationMarkdownText(v);
}

function memeBlock(m: Row): string {
  const safety = SAFETY_LEVELS[m.safety_level];
  const url = `${SITE_URL}${memePathFrom(m.short_id, m.slug)}`;
  const lines: string[] = [];
  lines.push(`### ${oneLine(m.title)}`);
  lines.push(`- URL: ${url}`);
  lines.push(
    `- 사용 안전도: ${safety?.icon ?? ""} ${safety?.user ?? m.safety_level}`
  );
  if (m.origin_year) lines.push(`- 시기: ${m.origin_year}`);
  if (m.aliases?.length)
    lines.push(`- 별칭: ${m.aliases.map(oneLine).filter(Boolean).join(", ")}`);
  const summary = oneLine(m.summary);
  if (summary) lines.push(`- 한 줄 뜻: ${summary}`);
  const desc = oneLine(m.description);
  if (desc) lines.push(`- 설명: ${desc}`);
  const origin = oneLine(m.origin);
  if (origin) lines.push(`- 유래(편집 설명): ${origin}`);
  const usage = oneLine(m.usage_note);
  if (usage) lines.push(`- 사용법: ${usage}`);
  const caution = oneLine(m.caution);
  if (caution) lines.push(`- 주의: ${caution}`);
  for (const example of parseUsageExamples(m.usage_examples)) {
    lines.push(
      `- 활용 예 · ${oneLine(example.situation)}: ${oneLine(example.text)}`,
    );
  }
  return lines.join("\n");
}

export async function GET() {
  let memes: Row[];
  let eligibleCount: number;

  try {
    const result = await loadApprovedIndexableMemes<Row>(createStaticClient(), {
      select:
        "id, title, short_id, slug, summary, published_at, moderation_status," +
        " description, origin, origin_year, usage_note, caution, aliases," +
        " category, safety_level, usage_examples, meme_sources(*), meme_contents(*)," +
        " meme_tags_map(tag_id)",
      primaryOrder: "published_at",
      limit: MAX_MEMES,
      countAll: true,
    });
    memes = result.rows;
    eligibleCount = result.eligibleCount;
  } catch (error) {
    console.error("[llms-full.txt] publication export failed", error);
    return publicationExportUnavailableResponse();
  }

  // 카테고리별로 묶어 사람이 읽어도 자연스럽게
  const byCat = new Map<MemeCategory, Row[]>();
  for (const meme of memes) {
    const categoryRows = byCat.get(meme.category) ?? [];
    categoryRows.push(meme);
    byCat.set(meme.category, categoryRows);
  }
  const sections: string[] = [];
  for (const displayCategory of DISPLAY_CATEGORY_LIST) {
    if (displayCategory.key === AI_MEME_DISPLAY_CATEGORY) continue;
    const categoryRows = displayCategory.categories.flatMap(
      (category) => byCat.get(category) ?? [],
    );
    if (!categoryRows.length) continue;
    sections.push(
      `## ${displayCategory.user}\n\n${categoryRows.map(memeBlock).join("\n\n")}`,
    );
  }
  const bodyMemes = sections.join("\n\n");
  const countLine = eligibleCount.toLocaleString("en-US");

  const safetyLegend = (Object.keys(SAFETY_LEVELS) as SafetyLevel[])
    .map((k) => `- ${SAFETY_LEVELS[k].icon} ${SAFETY_LEVELS[k].user}`)
    .join("\n");

  const body = `# 밈캐치 (MemeCatch) — 전체 본문

> 한국 밈·유행어·챌린지 ${countLine}건의 뜻·유래·사용 안전도를 기록하는 밈 사전.
> 이 문서는 답변엔진이 링크 크롤링 없이도 참고할 수 있도록, 최근 등록된 검수 항목 최대 ${MAX_MEMES}건의 공개 본문을 담습니다.
> 공개 승인 상태이고 사이트의 콘텐츠 충실도 기준을 통과한 항목만 포함합니다. 이는 독립적인 사실 검증 완료를 뜻하지 않으며, 제3자 원본 영상·이미지는 저장하지 않고 출처 링크로만 제공합니다.
> 유래는 편집 설명이며, 연결된 출처 URL 자체가 해당 유래 주장을 독립적으로 입증한다는 뜻은 아닙니다.
> 언어: 한국어(ko). 전체 밈 URL 목록은 ${SITE_URL}/sitemap.xml 을, 요약 인덱스는 ${SITE_URL}/llms.txt 를 참고하세요.

## Reviewed translations
${SEO_CONTENT_LOCALES.map((locale) => `- ${locale}: ${SITE_URL}/${locale}/llms-full.txt`).join("\n")}

## 사용 안전도(신호등) 범례
${safetyLegend}

## 인용 안내
- 밈 상세 페이지 URL 형식: ${SITE_URL}/memes/{short_id}-{밈이름}
- 각 페이지는 JSON-LD(DefinedTerm·WebPage)로 구조화되어 있습니다.
- 문의: ${CONTACT_EMAIL}

${bodyMemes || "- (본문은 사이트에서 확인하세요)"}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": "ko-KR",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
