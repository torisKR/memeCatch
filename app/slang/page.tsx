import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { SITE_URL } from "@/lib/site";
import { memePathFrom } from "@/lib/labels";
import { getSlangTermsByYearRange, type SlangTermRow } from "@/lib/queries";
import { createStaticClient } from "@/lib/supabase/server";
import {
  SlangDictionary,
  SlangDictionaryFromQuery,
  type SlangEra,
} from "@/components/slang-dictionary";
import { AdsenseScript } from "@/components/adsense-script";

/**
 * /slang — 줄임말·유행어 사전 (연대별 브라우징).
 * 문서는 ISR 정적 셸(1시간)로 유지한다. ?era=는 캐시 키가 아니므로 서버에서
 * searchParams를 읽으면 라우트가 동적(ƒ)으로 떨어진다(ISR 함정) — 네 연대
 * 패널을 전부 정적으로 렌더하고, 탭 활성 상태만 클라이언트(useSearchParams,
 * Suspense 내부)에서 URL과 동기화한다. 쿠키/헤더 읽기 금지(메모리 규칙).
 */
export const revalidate = 3600;

/** 연대당 표시 상한 — 초과분은 "탐색에서 더 보기"로 유도 */
const TERMS_PER_ERA = 60;
/** DefinedTermSet JSON-LD에 싣는 연대별 표제어 수 */
const SCHEMA_TERMS_PER_ERA = 20;

const ERA_DEFS = [
  {
    key: "now",
    label: "요즘",
    range: "2020~",
    from: 2020,
    to: 2029,
    // explore의 year 필터 키(2020s/2010s/2000s)와 맞춘 딥링크
    exploreHref: "/explore?category=phrase&year=2020s",
  },
  {
    key: "2010s",
    label: "2010년대",
    range: "2010~19",
    from: 2010,
    to: 2019,
    exploreHref: "/explore?category=phrase&year=2010s",
  },
  {
    key: "2000s",
    label: "2000년대",
    range: "2000~09",
    from: 2000,
    to: 2009,
    exploreHref: "/explore?category=phrase&year=2000s",
  },
  {
    key: "1990s",
    label: "1990년대",
    range: "1990~99",
    from: 1990,
    to: 1999,
    // explore year 필터에 1990s 키가 없음 — 카테고리 필터만 연결
    exploreHref: "/explore?category=phrase",
  },
] as const;

function rowToTerm(row: SlangTermRow): SlangEra["terms"][number] {
  return {
    href: memePathFrom(row.short_id, row.slug),
    title: row.title,
    summary: row.summary,
    safety: row.safety_level,
    year: row.origin_year,
  };
}

/** 네 연대 상위 표제어 — generateMetadata·본문 중복 호출을 React cache로 dedupe */
const loadSlangEras = cache(async (): Promise<SlangEra[]> => {
  const results = await Promise.all(
    ERA_DEFS.map((def) => getSlangTermsByYearRange(def.from, def.to, TERMS_PER_ERA))
  );
  return ERA_DEFS.map((def, i) => ({
    key: def.key,
    label: def.label,
    range: def.range,
    exploreHref: def.exploreHref,
    terms: results[i].map(rowToTerm),
  }));
});

/**
 * 위험 패널(5번째 탭) — red+yellow 유행어 상위. "요즘 쓰면 위험한 말" 진입점으로,
 * 행을 누르면 상세의 "이 판정의 근거" 블록으로 이어진다.
 * lib/queries.ts는 에이전트 A 담당이라 이 페이지에서 createStaticClient로 직접 조회.
 */
const loadRiskyTerms = cache(async (): Promise<SlangEra["terms"]> => {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(
        "id, short_id, slug, title, summary, safety_level, origin_year, trend_score"
      )
      .eq("category", "phrase")
      .in("moderation_status", ["approved", "limited"])
      .in("safety_level", ["red", "yellow"])
      .order("trend_score", { ascending: false })
      .order("id", { ascending: false })
      .limit(TERMS_PER_ERA);
    if (error || !data) return [];
    // red(쓰면 위험)를 먼저 — 같은 등급 안에서는 trend 순 유지(stable sort)
    return [...(data as SlangTermRow[])]
      .sort(
        (a, b) =>
          Number(b.safety_level === "red") - Number(a.safety_level === "red")
      )
      .map(rowToTerm);
  } catch {
    return [];
  }
});

/** 연대 대표 표제어 — 대조 문구·메타 설명용(짧은 제목 우선, 없으면 1위) */
function pickShowcase(era: SlangEra): string | null {
  const short = era.terms.slice(0, 5).find((t) => t.title.length <= 10);
  return (short ?? era.terms[0])?.title ?? null;
}

const BASE_DESCRIPTION =
  "요즘 애들이 쓰는 신조어부터 1990년대 하이루 세대의 유행어까지 — 연대별로 넘겨 보며 한 줄 뜻과 사용 안전 신호등을 확인하는 줄임말·유행어 사전.";

export async function generateMetadata(): Promise<Metadata> {
  const eras = await loadSlangEras();
  // 연대순(과거→현재)으로 대표 표제어를 뽑아 설명에 싣는다
  const parts = [...eras]
    .reverse()
    .flatMap((era) => {
      const showcase = pickShowcase(era);
      return showcase ? [`${era.label} ${showcase}`] : [];
    });
  const description =
    parts.length >= 2
      ? `${parts.join(", ")}까지 — 연대별 한 줄 뜻과 사용 안전 신호등으로 정리한 줄임말·유행어 사전.`
      : BASE_DESCRIPTION;

  return {
    title: "줄임말·유행어 사전",
    description,
    alternates: { canonical: "/slang" },
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title: "줄임말·유행어 사전",
      description,
      url: "/slang",
    },
  };
}

export default async function SlangPage() {
  const [eras, riskyTerms] = await Promise.all([
    loadSlangEras(),
    loadRiskyTerms(),
  ]);
  const hasTerms = eras.some((era) => era.terms.length > 0);

  // 위험 패널은 표제어가 있을 때만 5번째 탭으로 추가(정적 4패널+hidden 구조 유지).
  // JSON-LD·세대 대조·메타는 연대 패널(eras) 기준 그대로 — 위험 패널은 뷰 재배열일 뿐.
  const panels: SlangEra[] =
    riskyTerms.length > 0
      ? [
          ...eras,
          {
            key: "risky",
            label: "주의·위험",
            range: "",
            // explore에 안전 등급 필터가 없어 더 보기 링크는 감춘다
            exploreHref: "",
            description:
              "지금 쓰면 위험하거나 맥락 주의가 필요한 말만 모았어요. 표제어를 누르면 상세에서 ‘이 판정의 근거’를 확인할 수 있어요.",
            terms: riskyTerms,
          },
        ]
      : eras;

  // 세대 대조 한 줄 — 1990년대 vs 요즘 대표 표제어(데이터 없으면 정적 폴백)
  const thenTerm =
    pickShowcase(eras.find((e) => e.key === "1990s") ?? eras[eras.length - 1]) ??
    "하이루";
  const nowTerm = pickShowcase(eras[0]) ?? "럭키비키";

  const schemaTerms = eras.flatMap((era) =>
    era.terms.slice(0, SCHEMA_TERMS_PER_ERA)
  );

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      <AdsenseScript />
      {schemaTerms.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "DefinedTermSet",
              "@id": `${SITE_URL}/slang#termset`,
              name: "줄임말·유행어 사전",
              description:
                "1990년대부터 지금까지, 연대별 한국 줄임말·유행어의 뜻과 사용 안전도를 정리한 용어집.",
              url: `${SITE_URL}/slang`,
              inLanguage: "ko",
              hasDefinedTerm: schemaTerms.map((term) => ({
                "@type": "DefinedTerm",
                name: term.title,
                description: term.summary,
                url: `${SITE_URL}${term.href}`,
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}

      <h1 className="text-3xl font-extrabold tracking-tight">
        줄임말·유행어 사전
      </h1>
      {/* 고유 인트로 — 씬 콘텐츠 방지 + AI 인용 가능 블록(GEO 톤) */}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        지금 쓰는 줄임말과 예전에 유행했던 말을 연대별로 모았어요. 1990년대
        PC통신 인사말부터 2000년대 싸이월드 감성 문구, 2010년대 급식체, 그리고
        요즘 SNS와 숏폼에서 도는 신조어까지 — 표제어마다 한 줄 뜻과 함께 지금
        써도 되는지 신호등으로 알려줘요.
      </p>

      {/* 세대 대조 한 줄 — 재미 요소(과하지 않게 한 줄만) */}
      <p className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted">
        <span aria-hidden className="text-accent">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3l4 4-4 4" />
            <path d="M21 7H8a4 4 0 0 0-4 4" />
            <path d="M7 21l-4-4 4-4" />
            <path d="M3 17h13a4 4 0 0 0 4-4" />
          </svg>
        </span>
        <span>
          그때는 <b className="font-bold text-foreground">“{thenTerm}”</b>,
          지금은 <b className="font-bold text-foreground">“{nowTerm}”</b>
        </span>
      </p>

      {!hasTerms ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-bold">사전을 아직 준비 중이에요</p>
          <p className="mt-1.5 text-base text-muted">
            유행어가 검수를 통과하면 이 페이지가 채워져요. 잠시 후 다시 들러
            주세요.
          </p>
        </div>
      ) : (
        // 정적 셸에는 기본 탭(요즘) 뷰를 그대로 싣고, 하이드레이션 후 ?era=와 동기화
        <Suspense fallback={<SlangDictionary eras={panels} />}>
          <SlangDictionaryFromQuery eras={panels} />
        </Suspense>
      )}
    </main>
  );
}
