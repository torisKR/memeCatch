import { CATEGORIES, memePathFrom, type MemeCategory } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";


/**
 * 구조화 데이터(JSON-LD) — GEO 감사(2026-07-10) 반영 전면 확장.
 * 전부 서버 컴포넌트에서 렌더해 초기 HTML에 포함(JS 미실행 AI 크롤러 대응).
 * 원칙: 실데이터만 채움(허위 필드 금지), 페이지당 타입 중복 없음.
 */

/** XSS 방지: JSON 문자열 내 < 를 유니코드 이스케이프 */
function safeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function Script({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

/** Organization — 전 페이지(layout) 1회. sameAs로 엔티티 그래프 연결 */
export function OrganizationJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${SITE_URL}#org`,
        name: "밈캐치",
        alternateName: ["MemeCatch", "catchmeme"],
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        description:
          "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지 알려주는 한국 밈 실시간 사전.",
        email: "ironjustlikethat@gmail.com",
        sameAs: [
          "https://github.com/toris-dev/memeCatch",
          "https://fairy.hada.io/@toris-dev",
        ],
      }}
    />
  );
}

/** 사이트 전체용 WebSite 스키마 + SearchAction (홈) */
export function WebSiteJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "밈캐치",
        url: SITE_URL,
        inLanguage: "ko",
        publisher: { "@id": `${SITE_URL}#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

/** DefinedTermSet 실체 선언 — 홈. 상세의 inDefinedTermSet(@id)이 가리키는 대상 */
export function DefinedTermSetJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        "@id": `${SITE_URL}#glossary`,
        name: "밈캐치 밈 사전",
        description: "1990년대부터 오늘까지, 한국 유행 밈·유행어·챌린지 용어집",
        url: SITE_URL,
      }}
    />
  );
}

/**
 * 밈 상세 — WebPage 래퍼(datePublished/dateModified/speakable) +
 * mainEntity로 DefinedTerm(@id #glossary 참조). 기존 단독 DefinedTerm을 대체.
 */
export function MemeWebPageJsonLd({
  name,
  summary,
  description,
  shortId,
  slug,
  datePublished,
  dateModified,
}: {
  name: string;
  summary: string;
  description: string;
  shortId: string;
  slug: string;
  datePublished: string | null;
  dateModified: string | null;
}) {
  const url = `${SITE_URL}${memePathFrom(shortId, slug)}`;
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name,
        description: summary,
        url,
        inLanguage: "ko",
        ...(datePublished ? { datePublished } : {}),
        ...(dateModified ? { dateModified } : {}),
        isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
        publisher: { "@id": `${SITE_URL}#org` },
        // 정답 카드(밈명+한 줄 뜻) — "3초 안에 알려드려요" 컨셉과 일치하는 음성 답변 대상
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector: ["h1", "section[aria-label='정답 카드'] p"],
        },
        mainEntity: {
          "@type": "DefinedTerm",
          name,
          description: description || summary,
          url,
          inDefinedTermSet: {
            "@type": "DefinedTermSet",
            "@id": `${SITE_URL}#glossary`,
            name: "밈캐치 밈 사전",
            url: SITE_URL,
          },
        },
      }}
    />
  );
}

/** 밈 상세 — BreadcrumbList (홈 › 카테고리 › 밈) */
export function MemeBreadcrumbJsonLd({
  category,
  name,
  shortId,
  slug,
}: {
  category: MemeCategory;
  name: string;
  shortId: string;
  slug: string;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "밈캐치", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: CATEGORIES[category].user,
            item: `${SITE_URL}/explore?category=${category}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name,
            item: `${SITE_URL}${memePathFrom(shortId, slug)}`,
          },
        ],
      }}
    />
  );
}

/** 밈 상세 — 대표 유튜브 영상 VideoObject (실존 임베드가 있을 때만) */
export function MemeVideoJsonLd({
  name,
  description,
  videoId,
  thumbnailUrl,
  uploadDate,
  caption,
}: {
  name: string;
  description: string;
  videoId: string;
  thumbnailUrl?: string | null;
  /**
   * 밈 페이지 게시일(근사값). 한때 "원본 업로드일이 아니라 오정보"라는 이유로
   * 생략했으나, 서치콘솔이 uploadDate 누락을 '심각한 문제'로 판정해(비디오
   * 색인 요건) 복원한다 — 이 페이지에 영상이 게시된 날짜로서의 근사값이며,
   * 원본 업로드일 컬럼이 생기면 교체한다.
   */
  uploadDate?: string | null;
  caption?: string | null;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `${name} — 대표 영상`,
        description: caption || description,
        thumbnailUrl: thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
        ...(uploadDate ? { uploadDate } : {}),
      }}
    />
  );
}

/** /rankings — 순위 ItemList */
export function RankingsJsonLd({
  items,
}: {
  items: { title: string; short_id: string; slug: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "밈캐치 오늘의 랭킹",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: items.length,
        itemListElement: items.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: m.title,
          url: `${SITE_URL}${memePathFrom(m.short_id, m.slug)}`,
        })),
      }}
    />
  );
}

/** /explore — CollectionPage (무한 스크롤이라 전수 ItemList는 과대표현 → 페이지 선언만) */
export function ExploreCollectionJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "밈 탐색",
        description:
          "카테고리·연도·난이도로 거르고 급상승·최신·인기·논쟁 순으로 전체 밈을 탐색해요.",
        url: `${SITE_URL}/explore`,
        inLanguage: "ko",
        isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
      }}
    />
  );
}

/**
 * /news — CollectionPage + 브리핑 ItemList.
 * ko 정적 데이터 기준(서버는 DEFAULT_LOCALE로만 렌더 — ISR 유지, M10과 일관).
 * 브리핑은 개별 URL이 없어 세대 앵커(#age-20s 등)로 연결한다.
 */
export function NewsCollectionJsonLd({
  briefs,
}: {
  briefs: { audience: string; title: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "세대별 밈 소식",
        description:
          "20대·30대·40대가 알아두면 좋은 밈과 디지털 생활 정보를 짧은 체크리스트로 정리합니다.",
        url: `${SITE_URL}/news`,
        inLanguage: "ko",
        isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
        publisher: { "@id": `${SITE_URL}#org` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: briefs.length,
          itemListElement: briefs.map((brief, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: brief.title,
            url: `${SITE_URL}/news#age-${brief.audience}`,
          })),
        },
      }}
    />
  );
}

/** 커뮤니티 글 상세 — DiscussionForumPosting */
export function ForumPostingJsonLd({
  postId,
  title,
  body,
  authorNickname,
  createdAt,
  likeCount,
  commentCount,
}: {
  postId: string;
  title: string;
  body: string;
  authorNickname: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}) {
  const postUrl = `${SITE_URL}/community/${postId}`;
  const authorUrl = `${postUrl}#author`;

  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: title,
        text: body.slice(0, 500),
        datePublished: createdAt,
        url: postUrl,
        author: {
          "@type": "Person",
          name: authorNickname,
          url: authorUrl,
        },
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: likeCount,
        },
        commentCount,
      }}
    />
  );
}
