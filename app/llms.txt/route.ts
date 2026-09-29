import { createStaticClient } from "@/lib/supabase/server";
import { SITE_URL, CONTACT_EMAIL } from "@/lib/site";
import { DISPLAY_CATEGORY_LIST, memePathFrom } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";
import { SEO_CONTENT_LOCALES } from "@/lib/i18n-routing";
import {
  loadApprovedIndexableMemes,
  publicationExportUnavailableResponse,
} from "@/lib/publication-export";
import type { ContentDepthInput } from "@/lib/content-depth";


/** llms.txt — AI 시스템용 사이트 안내 (https://llmstxt.org 규격). 1시간 재검증 */
export const revalidate = 3600;

type LlmsIndexRow = ContentDepthInput & {
  id: string;
  title: string;
  summary: string;
  short_id: string;
  slug: string;
};

function inlineMarkdown(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/([\[\]])/g, "\\$1");
}

export async function GET() {
  let trending: LlmsIndexRow[];
  let eligibleCount: number;
  try {
    const result = await loadApprovedIndexableMemes<LlmsIndexRow>(
      createStaticClient(),
      {
        select:
          "id, title, summary, short_id, slug, description, origin, usage_note," +
          " caution, usage_examples, meme_sources(source_url)," +
          " meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
        primaryOrder: "trend_score",
        limit: 15,
        countAll: true,
      },
    );
    trending = result.rows;
    eligibleCount = result.eligibleCount;
  } catch (error) {
    console.error("[llms.txt] publication export failed", error);
    return publicationExportUnavailableResponse();
  }

  const countLine = eligibleCount.toLocaleString("en-US");
  const trendingBlock = trending.length
    ? trending
        .map(
          (meme) =>
            `- [${inlineMarkdown(meme.title)}](${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}): ${inlineMarkdown(meme.summary)}`,
        )
        .join("\n")
    : "";

  const categories = DISPLAY_CATEGORY_LIST
    .map(({ key, user }) => `- [${user}](${SITE_URL}/explore?category=${key})`)
    .join("\n");

  const body = `# 밈캐치 (MemeCatch)

> 한국 밈·유행어·챌린지 ${countLine}건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전.
> 각 밈은 "무슨 뜻인가 / 어디서 시작됐나 / 지금 써도 되는가(신호등)" 구조로 정리되어 있으며,
> 공개 승인 상태이고 사이트의 콘텐츠 충실도 기준을 통과한 항목만 포함합니다. 이는 독립적인 사실 검증 완료를 뜻하지 않습니다. 언어: 한국어(ko).
> English summary: MemeCatch explains Korean memes, slang, and challenges with meaning, origin, usage context, safety signals, and source attribution.

## 다국어 / Languages
${SEO_CONTENT_LOCALES.map((locale) => `- [${locale} index](${SITE_URL}/${locale}/llms.txt) · [${locale} reviewed corpus](${SITE_URL}/${locale}/llms-full.txt)`).join("\n")}

주요 진입점:
- [전체 밈 탐색](${SITE_URL}/explore): 카테고리·연도·난이도 필터 + 검색
- [검색](${SITE_URL}/search): 키워드·초성·별칭 검색
- [밈 연표](${SITE_URL}/timeline): 1990년대부터 지금까지 연대별 대표 밈
- [줄임말·유행어 사전](${SITE_URL}/slang): 요즘 신조어부터 1990년대 유행어까지 연대별 표제어·뜻·사용 안전도
- [밈력고사](${SITE_URL}/quiz): 사전 데이터로 매번 새로 출제되는 10문항 밈 지식 퀴즈
- [이번 주 밈 결산](${SITE_URL}/weekly): 매주 자동 갱신되는 급상승·신규 정리
- [오늘의 랭킹](${SITE_URL}/rankings)
- [전체 사이트맵](${SITE_URL}/sitemap.xml): 밈 상세 페이지 전체 URL
- [RSS 피드](${SITE_URL}/feed.xml): 최신 등록 밈

## 카테고리
${categories}

## 테마별 모음
${COLLECTIONS.map((c) => `- [${c.title}](${SITE_URL}/collections/${c.slug}): ${c.description}`).join("\n")}

## 지금 뜨는 밈
${trendingBlock || "- (실시간 목록은 사이트에서 확인)"}

## 인용 안내
- 밈 상세 페이지 URL 형식: ${SITE_URL}/memes/{short_id}-{밈이름}
- 각 페이지는 JSON-LD(DefinedTerm·WebPage)로 구조화되어 있습니다.
- 제3자 원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공합니다.
- 문의: ${CONTACT_EMAIL}

## 정책
- [소개 및 검수 원칙](${SITE_URL}/about)
- [개인정보처리방침](${SITE_URL}/privacy)
- [이용약관](${SITE_URL}/terms)
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": "ko-KR",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
