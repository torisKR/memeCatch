import type { Metadata } from "next";
import { NewsCollectionJsonLd } from "@/components/json-ld";
import { NewsPageContent } from "@/components/news-page-content";
import type { Audience } from "@/lib/meme-commerce";
import { getBriefsForAudience, type MemeNewsBrief } from "@/lib/meme-news";
import { getGenerationHighlights } from "@/lib/queries";
import { PAGE_COPY } from "@/lib/i18n-pages";

/**
 * ISR 로케일 함정 주의: 여기서 getRequestLocale()(=headers())를 읽으면 페이지가
 * 요청-동적(ƒ)으로 강등되어 revalidate가 무의미해지고 매 요청 SSR이 된다.
 * 서버는 DEFAULT_LOCALE(ko) 기준으로만 정적 렌더하고, 사용자 로케일 카피는
 * NewsPageContent(클라이언트)가 쿠키에서 복원해 표시한다. (app/layout.tsx 참고)
 */
const copy = PAGE_COPY.ko;

export const metadata: Metadata = {
  title: copy.newsTitle,
  description: copy.newsDescription,
  alternates: { canonical: "/news" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: copy.newsTitle,
    description: copy.newsDescription,
    url: "/news",
  },
};

export const revalidate = 1800;

const AUDIENCES = ["20s", "30s", "40s"] as const;

export default async function NewsPage() {
  const highlights = await getGenerationHighlights(3);
  const briefs = {
    "20s": getBriefsForAudience("20s"),
    "30s": getBriefsForAudience("30s"),
    "40s": getBriefsForAudience("40s"),
  } satisfies Record<Audience, readonly MemeNewsBrief[]>;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      {/* JSON-LD는 ko 정적 데이터 기준 — 클라이언트 로케일과 무관(ISR 유지) */}
      <NewsCollectionJsonLd
        briefs={AUDIENCES.flatMap((audience) =>
          briefs[audience].map((brief) => ({ audience, title: brief.title })),
        )}
      />
      <NewsPageContent highlights={highlights} briefs={briefs} />
    </main>
  );
}
