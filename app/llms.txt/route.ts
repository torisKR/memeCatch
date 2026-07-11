import { createStaticClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import { CATEGORIES, memePathFrom, type MemeCategory } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";


/** llms.txt — AI 시스템용 사이트 안내 (https://llmstxt.org 규격). 1시간 재검증 */
export const revalidate = 3600;

export async function GET() {
  let trendingBlock = "";
  let countLine = "3,000+";
  try {
    const supabase = createStaticClient();
    const [{ data: trending }, { count }] = await Promise.all([
      supabase
        .from("memes")
        .select("title, summary, short_id, slug")
        .eq("moderation_status", "approved")
        .order("trend_score", { ascending: false })
        .limit(15),
      supabase
        .from("memes")
        .select("id", { count: "exact", head: true })
        .in("moderation_status", ["approved", "limited"]),
    ]);
    if (count) countLine = count.toLocaleString("en-US");
    if (trending?.length) {
      trendingBlock = trending
        .map(
          (m) =>
            `- [${m.title}](${SITE_URL}${memePathFrom(m.short_id, m.slug)}): ${m.summary}`
        )
        .join("\n");
    }
  } catch {
    // DB 실패 시 정적 본문만 제공
  }

  const categories = (Object.keys(CATEGORIES) as MemeCategory[])
    .map(
      (key) =>
        `- [${CATEGORIES[key].user}](${SITE_URL}/explore?category=${key})`
    )
    .join("\n");

  const body = `# 밈캐치 (MemeCatch)

> 한국 밈·유행어·챌린지 ${countLine}건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전.
> 각 밈은 "무슨 뜻인가 / 어디서 시작됐나 / 지금 써도 되는가(신호등)" 구조로 정리되어 있으며,
> 운영자 검수(사실 확인 → 저작권 확인)를 거쳐 공개됩니다. 언어: 한국어(ko).

주요 진입점:
- [전체 밈 탐색](${SITE_URL}/explore): 카테고리·연도·난이도 필터 + 검색
- [검색](${SITE_URL}/search): 키워드·초성·별칭 검색
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
- 원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공합니다.
- 문의: ironjustlikethat@gmail.com

## 정책
- [소개 및 검수 원칙](${SITE_URL}/about)
- [개인정보처리방침](${SITE_URL}/privacy)
- [이용약관](${SITE_URL}/terms)
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
