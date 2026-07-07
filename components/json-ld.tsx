import { memePathFrom } from "@/lib/labels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * 구조화 데이터(JSON-LD) 컴포넌트 (레인 E 제공 — 밈 상세 페이지에서 사용)
 *
 * 사용 예 (app/memes/[key]/page.tsx):
 *   <MemeJsonLd name={meme.title} description={meme.summary}
 *               shortId={meme.short_id} slug={meme.slug} />
 */

/** XSS 방지: JSON 문자열 내 < 를 유니코드 이스케이프 */
function safeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function MemeJsonLd({
  name,
  description,
  shortId,
  slug,
}: {
  /** 밈명 (memes.title) */
  name: string;
  /** 한 줄 뜻 (memes.summary) */
  description: string;
  shortId: string;
  slug: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name,
    description,
    url: `${SITE_URL}${memePathFrom(shortId, slug)}`,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "밈캐치",
      url: SITE_URL,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

/** 사이트 전체용 WebSite 스키마 (홈에서 선택적으로 사용 가능) */
export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "밈캐치",
    url: SITE_URL,
    inLanguage: "ko",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
