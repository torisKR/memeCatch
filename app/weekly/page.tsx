import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { memePathFrom } from "@/lib/labels";
import { getWeeklyDigest } from "@/lib/weekly";
import { WeeklyDigest } from "@/components/weekly-digest";

/**
 * 주간 결산 — 완전 자동 콘텐츠 자산(수동 큐레이션 0).
 * KST 월~일 기준 이번 주 급상승·신규·카테고리 분포를 요청 시 조립한다.
 * 문서는 요청별 SSR이며, revalidate는 캐시 가능한 fetch의 세그먼트 기본값이다.
 * 사이트맵/RSS 등록은 오케스트레이터 담당 — 여기서는 라우트만 존재하면 된다.
 */
export const revalidate = 3600;

const WEEKLY_TITLE = "이번 주 밈 결산 — 급상승·신규 총정리";
const WEEKLY_DESCRIPTION =
  "이번 주 한국에서 급상승한 밈, 새로 등록된 밈, 카테고리 분포를 한 번에 모아봤어요.";

export const metadata: Metadata = {
  title: WEEKLY_TITLE,
  description: WEEKLY_DESCRIPTION,
  alternates: { canonical: "/weekly" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: WEEKLY_TITLE,
    description: WEEKLY_DESCRIPTION,
    url: "/weekly",
  },
};

export default async function WeeklyPage() {
  const digest = await getWeeklyDigest();
  const { range } = digest;
  const url = `${SITE_URL}/weekly`;

  // JSON-LD 스키마용 아이템 — 급상승을 우선하고 부족하면 신규로 채운다
  const schemaItems =
    digest.trending.length > 0 ? digest.trending : digest.fresh;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      {/* CollectionPage + ItemList — 주간 결산의 구조화 데이터 */}
      {schemaItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `${range.year}년 ${range.month}월 ${range.weekOfMonth}주차 밈 결산`,
              description: metadata.description,
              url,
              inLanguage: "ko",
              isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: schemaItems.length,
                itemListElement: schemaItems.slice(0, 10).map((m, i) => ({
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

      <nav aria-label="브레드크럼" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          밈캐치
        </Link>{" "}
        <span aria-hidden>›</span> 주간 결산
      </nav>

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {range.year}년 {range.month}월 {range.weekOfMonth}주차 밈 결산
        </h1>
        {range.isOngoing && (
          <span
            className="inline-flex h-fit items-center rounded-full bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent"
            title="이번 주가 아직 끝나지 않아 데이터가 계속 갱신돼요"
          >
            집계 중
          </span>
        )}
      </div>

      {/* 고유 인트로 — 씬 콘텐츠 방지 + AI 인용 가능 블록 */}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        이번 주 밈캐치에서 급상승한 밈과 새로 등록된 밈을 자동으로 모았어요.
        지금 이 순간에도 급상승 순위가 계속 바뀌고 있어서, 매시 새로 집계돼요.
        지나간 유행을 놓쳤다면 여기서 한 번에 따라잡아 보세요.
      </p>

      <WeeklyDigest digest={digest} />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/rankings"
          className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-[filter] hover:brightness-95 active:scale-[0.97]"
        >
          전체 랭킹 보기 <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link
          href="/explore"
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-6 text-base font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
        >
          전체 탐색하기
        </Link>
      </div>
    </main>
  );
}
