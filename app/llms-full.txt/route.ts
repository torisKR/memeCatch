import { createStaticClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import {
  CATEGORIES,
  SAFETY_LEVELS,
  memePathFrom,
  type MemeCategory,
  type SafetyLevel,
} from "@/lib/labels";

/**
 * llms-full.txt — AI 시스템용 사이트 "전체 본문" (https://llmstxt.org 규격의 full 변형).
 * llms.txt가 요약 인덱스라면, 여기는 밈별 뜻·유래·사용 안전도까지 담은 완결 콘텐츠를 제공해
 * 답변엔진(ChatGPT/Perplexity 등)이 링크를 크롤링하지 않고도 정확히 인용할 수 있게 한다.
 * 크기 제어를 위해 트렌드 상위 순으로 상한을 둔다(전체 URL은 sitemap.xml로 안내).
 */
export const revalidate = 3600;

const MAX_MEMES = 400;

type Row = {
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
};

function oneLine(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/\s+/g, " ").trim();
}

function memeBlock(m: Row): string {
  const safety = SAFETY_LEVELS[m.safety_level];
  const url = `${SITE_URL}${memePathFrom(m.short_id, m.slug)}`;
  const lines: string[] = [];
  lines.push(`### ${m.title}`);
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
  if (origin) lines.push(`- 유래: ${origin}`);
  const usage = oneLine(m.usage_note);
  if (usage) lines.push(`- 사용법·주의: ${usage}`);
  return lines.join("\n");
}

export async function GET() {
  let bodyMemes = "";
  let countLine = "3,000+";

  try {
    const supabase = createStaticClient();
    const [{ data: memes }, { count }] = await Promise.all([
      supabase
        .from("memes")
        .select(
          "title, short_id, slug, summary, description, origin, origin_year, usage_note, aliases, category, safety_level"
        )
        // llms.txt / sitemap.ts와 동일 기준(approved만) — 카운트·URL 정합 유지
        .eq("moderation_status", "approved")
        .order("trend_score", { ascending: false })
        .limit(MAX_MEMES),
      supabase
        .from("memes")
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", "approved"),
    ]);

    if (count) countLine = count.toLocaleString("en-US");

    if (memes?.length) {
      // 카테고리별로 묶어 사람이 읽어도 자연스럽게
      const byCat = new Map<MemeCategory, Row[]>();
      for (const m of memes as Row[]) {
        const arr = byCat.get(m.category) ?? [];
        arr.push(m);
        byCat.set(m.category, arr);
      }
      const sections: string[] = [];
      for (const key of Object.keys(CATEGORIES) as MemeCategory[]) {
        const arr = byCat.get(key);
        if (!arr?.length) continue;
        sections.push(
          `## ${CATEGORIES[key].user}\n\n${arr.map(memeBlock).join("\n\n")}`
        );
      }
      bodyMemes = sections.join("\n\n");
    }
  } catch {
    // DB 실패 시 안내 본문만 제공
  }

  const safetyLegend = (Object.keys(SAFETY_LEVELS) as SafetyLevel[])
    .map((k) => `- ${SAFETY_LEVELS[k].icon} ${SAFETY_LEVELS[k].user}`)
    .join("\n");

  const body = `# 밈캐치 (MemeCatch) — 전체 본문

> 한국 밈·유행어·챌린지 ${countLine}건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전.
> 이 문서는 답변엔진이 링크 크롤링 없이도 인용할 수 있도록, 트렌드 상위 밈의 본문을 그대로 담은 것입니다.
> 운영자 검수(사실 확인 → 저작권 확인)를 거친 항목만 포함하며, 원본 영상·이미지는 저장하지 않고 출처 링크로만 제공합니다.
> 언어: 한국어(ko). 전체 밈 URL 목록은 ${SITE_URL}/sitemap.xml 을, 요약 인덱스는 ${SITE_URL}/llms.txt 를 참고하세요.

## 사용 안전도(신호등) 범례
${safetyLegend}

## 인용 안내
- 밈 상세 페이지 URL 형식: ${SITE_URL}/memes/{short_id}-{밈이름}
- 각 페이지는 JSON-LD(DefinedTerm·WebPage)로 구조화되어 있습니다.
- 문의: ironjustlikethat@gmail.com

${bodyMemes || "- (본문은 사이트에서 확인하세요)"}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
