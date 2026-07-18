import type { Metadata } from "next";
import { cache } from "react";
import { createStaticClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import { memePathFrom } from "@/lib/labels";
import { LIST_SELECT, type MemeListItem } from "@/lib/queries";
import { TimelineView, type TimelineDecade } from "@/components/timeline-view";

/**
 * 레인 A — /timeline: 한국 밈 연표 (1990년대 ~ 2020년대).
 * "밈 역사/연도별 밈" 검색 유입 + 체류형 탐험 페이지. 문서는 요청별 SSR이며,
 * revalidate는 명시적으로 캐시 가능한 fetch의 세그먼트 기본값으로만 유지한다.
 */
export const revalidate = 3600;

const PUBLIC_STATUSES = ["approved", "limited"] as const;
/** 연도당 카드 상한 */
const MAX_PER_YEAR = 8;
/** 후보 풀 상한 — 전체 밈 규모(약 3천여 건) 대비 여유 있는 상한 */
const CANDIDATE_LIMIT = 2500; // trend_score 상위 pool — 대표 밈 선별, 대량 fetch 방지

const DECADE_DEFS = [
  { key: "1990s", label: "1990년대", from: 1990, to: 1999 },
  { key: "2000s", label: "2000년대", from: 2000, to: 2009 },
  { key: "2010s", label: "2010년대", from: 2010, to: 2019 },
  { key: "2020s", label: "2020년대", from: 2020, to: 2029 },
] as const;

/**
 * 연대→연도별 대표 밈 그룹핑.
 * 요청당 한 번만 조회되도록 React cache로 감싸(generateMetadata·본문 중복 호출 dedupe).
 */
const loadTimeline = cache(async (): Promise<TimelineDecade[]> => {
  try {
    const supabase = createStaticClient();
    // trend_score 상위 pool을 먼저 뽑고 연도별로 버킷팅 — 연도 오름차순 limit이면
    // 데이터 증가 시 최신 연대가 조용히 잘리므로, 대표성(trend) 기준으로 선별한다.
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .not("origin_year", "is", null)
      .order("trend_score", { ascending: false })
      .limit(CANDIDATE_LIMIT);
    // 쿼리 에러는 throw해 아래 공통 catch에서 현재 요청의 빈 배열 폴백으로 처리한다.
    if (error) throw error;
    if (!data) return [];

    const rows = data as MemeListItem[];
    const byYear = new Map<number, MemeListItem[]>();
    for (const meme of rows) {
      const year = meme.origin_year;
      if (year == null) continue;
      const bucket = byYear.get(year) ?? [];
      if (bucket.length < MAX_PER_YEAR) {
        bucket.push(meme);
        byYear.set(year, bucket);
      }
    }

    const decades: TimelineDecade[] = [];
    for (const def of DECADE_DEFS) {
      const years = [...byYear.entries()]
        .filter(([year]) => year >= def.from && year <= def.to)
        .sort((a, b) => a[0] - b[0])
        .map(([year, memes]) => ({ year, memes }));
      if (years.length > 0) {
        decades.push({ key: def.key, label: def.label, years });
      }
    }
    return decades;
  } catch {
    return [];
  }
});

/** 연대별 대표 밈 하나씩 골라 메타 설명에 쓴다(있는 것만) */
function pickHighlights(decades: TimelineDecade[]) {
  const highlights: { label: string; title: string }[] = [];
  for (const decade of decades) {
    const top = decade.years
      .flatMap((y) => y.memes)
      .sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0))[0];
    if (top) highlights.push({ label: decade.label, title: top.title });
  }
  return highlights;
}

export async function generateMetadata(): Promise<Metadata> {
  const decades = await loadTimeline();
  const highlights = pickHighlights(decades);
  const description =
    highlights.length > 0
      ? `${highlights
          .map((h) => `${h.label} ${h.title}`)
          .join(", ")}까지 — 연도별 대표 밈으로 정리한 한국 밈 연표.`
      : "1990년대 유행어부터 2020년대 숏폼 챌린지까지, 연도별 대표 밈으로 정리한 한국 밈 연표.";

  return {
    title: "한국 밈 연표 — 1990년대부터 지금까지",
    description,
    alternates: { canonical: "/timeline" },
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title: "한국 밈 연표 — 1990년대부터 지금까지",
      description,
      url: "/timeline",
    },
  };
}

export default async function TimelinePage() {
  const decades = await loadTimeline();

  const schemaItems = decades
    .flatMap((d) => d.years.flatMap((y) => y.memes))
    .sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0))
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      {schemaItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "한국 밈 연표",
              description:
                "1990년대부터 2020년대까지, 연도별 대표 밈을 한눈에 모은 한국 밈 연표.",
              url: `${SITE_URL}/timeline`,
              inLanguage: "ko",
              isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: schemaItems.length,
                itemListElement: schemaItems.map((m, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: m.title,
                  url: `${SITE_URL}${memePathFrom(m.short_id, m.slug)}`,
                })),
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}

      <h1 className="text-3xl font-extrabold tracking-tight">한국 밈 연표</h1>
      {/* 고유 인트로 — 씬 콘텐츠 방지 + AI 인용 가능 블록(GEO 톤) */}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        한국 밈의 역사는 1990년대 개그 프로그램 유행어에서 시작해, 2000년대
        디시인사이드 짤방과 싸이월드 감성을 거쳐, 2010년대 급식체와 인터넷
        방송 밈으로 확장됐고, 2020년대 들어서는 숏폼 챌린지가 중심이 됐어요.
        이 페이지는 연도별 대표 밈을 모아, 각 시대를 상징하는 유행어와
        챌린지가 언제 등장해 어떻게 이어져 왔는지 한눈에 보여줘요.
      </p>

      {decades.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-bold">연표를 아직 준비 중이에요</p>
          <p className="mt-1.5 text-base text-muted">
            연도 정보가 확인된 밈이 모이면 이 페이지가 채워져요. 잠시 후 다시
            들러 주세요.
          </p>
        </div>
      ) : (
        <TimelineView decades={decades} />
      )}
    </main>
  );
}
