import {
  DISPLAY_CATEGORIES,
  memePathFrom,
  resolveDisplayCategory,
  type MemeCategory,
} from "@/lib/labels";
import { SITE_URL, CONTACT_EMAIL } from "@/lib/site";
import { citableSources, evidenceTimestamp, type CitableSourceInput } from "@/lib/source-links";
import type { PublicMemeProducedVideo } from "@/lib/video-production/public.server";
import { parseProducedVideoMetadata, producedVideoEmbedUrl } from "@/lib/video-production/video-schema.mjs";
import {
  absoluteSiteUrl,
  getSeoCopy,
  localizedMemePath,
  localizedPath,
  toHrefLang,
  type SeoRouteLocale,
} from "@/lib/i18n-routing";


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

/**
 * Organization — 전 페이지(layout) 1회. sameAs로 엔티티 그래프 연결.
 * publishingPrinciples/correctionsPolicy는 /editorial(편집 원칙) 실문서를
 * 가리킨다 — 발행자 신뢰신호(E-E-A-T). 없는 문서를 가리키면 안 된다.
 */
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
          "밈·유행어·챌린지의 뜻과 유래, 사용 맥락과 참고 자료를 정리하는 한국 밈 사전.",
        email: CONTACT_EMAIL,
        // 운영 주체를 명시 — 1인 운영임을 구조화 데이터에서도 숨기지 않는다.
        founder: {
          "@type": "Person",
          name: "toris-dev",
          url: "https://github.com/toris-dev",
        },
        publishingPrinciples: `${SITE_URL}/editorial`,
        correctionsPolicy: `${SITE_URL}/editorial#corrections`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT_EMAIL,
          url: `${SITE_URL}/support`,
          availableLanguage: ["ko", "en"],
        },
        sameAs: [
          "https://github.com/toris-dev/memeCatch",
          "https://fairy.hada.io/@toris-dev",
        ],
      }}
    />
  );
}

type LocalizedSchemaProps = {
  locale?: SeoRouteLocale;
  path?: string;
  name?: string;
};

/** 사이트 전체용 WebSite 스키마 + SearchAction (홈) */
export function WebSiteJsonLd({
  locale = "ko",
  path,
  name,
}: LocalizedSchemaProps = {}) {
  const copy = getSeoCopy(locale);
  const homePath = path ?? localizedPath("/", locale);
  const siteUrl = absoluteSiteUrl(homePath);
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: name ?? copy.siteName,
        url: siteUrl,
        inLanguage: toHrefLang(locale),
        publisher: { "@id": `${SITE_URL}#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${absoluteSiteUrl(localizedPath("/search", locale))}?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

/** DefinedTermSet 실체 선언 — 홈. 상세의 inDefinedTermSet(@id)이 가리키는 대상 */
export function DefinedTermSetJsonLd({
  locale = "ko",
  path,
  name,
  description,
}: LocalizedSchemaProps & { description?: string } = {}) {
  const copy = getSeoCopy(locale);
  const glossaryUrl = absoluteSiteUrl(path ?? localizedPath("/", locale));
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        "@id": `${glossaryUrl}#glossary`,
        name: name ?? copy.glossaryName,
        description: description ?? copy.glossaryDescription,
        url: glossaryUrl,
      }}
    />
  );
}

/**
 * 밈 상세 — WebPage 래퍼. mainEntity는 별도 DefinedTerm의 안정적인 @id를 참조한다.
 */
export function MemeWebPageJsonLd({
  name,
  summary,
  description,
  shortId,
  slug,
  datePublished,
  dateModified,
  sources = [],
  locale = "ko",
  path,
  siteName,
  sitePath,
}: {
  name: string;
  summary: string;
  description: string;
  shortId: string;
  slug: string;
  datePublished: string | null;
  dateModified: string | null;
  sources?: CitableSourceInput[];
  locale?: SeoRouteLocale;
  path?: string;
  siteName?: string;
  sitePath?: string;
  glossaryName?: string;
  glossaryPath?: string;
}) {
  const copy = getSeoCopy(locale);
  const url = absoluteSiteUrl(path ?? localizedMemePath(locale, shortId, slug));
  const localizedSiteUrl = absoluteSiteUrl(sitePath ?? localizedPath("/", locale));
  const published = evidenceTimestamp(datePublished);
  const modified = evidenceTimestamp(dateModified);
  const citations = citableSources(sources).map((source) => source.url);
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        name,
        description: description.trim() || summary,
        url,
        inLanguage: toHrefLang(locale),
        ...(published ? { datePublished: published } : {}),
        ...(modified ? { dateModified: modified } : {}),
        ...(citations.length ? { citation: citations } : {}),
        isPartOf: {
          "@type": "WebSite",
          name: siteName ?? copy.siteName,
          url: localizedSiteUrl,
        },
        publisher: { "@id": `${SITE_URL}#org` },
        mainEntity: {
          "@id": `${url}#term`,
        },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      }}
    />
  );
}

/**
 * 밈 상세 — 독립 최상위 DefinedTerm(사전 항목) JSON-LD.
 * WebPage.mainEntity가 이 노드의 @id를 참조하며, 화면의 한 줄 요약을 정의로 쓴다.
 * TODO(후속 범위): 번역본이 있으면 workTranslation/translationOfWork로
 * 로케일 간 연결 — 이번 작업 범위 밖.
 */
export function MemeDefinedTermJsonLd({
  name,
  summary,
  shortId,
  slug,
  locale = "ko",
  path,
  glossaryName,
  glossaryPath,
}: {
  name: string;
  summary: string;
  shortId: string;
  slug: string;
  locale?: SeoRouteLocale;
  path?: string;
  glossaryName?: string;
  glossaryPath?: string;
}) {
  const copy = getSeoCopy(locale);
  const url = absoluteSiteUrl(path ?? localizedMemePath(locale, shortId, slug));
  const localizedGlossaryUrl = absoluteSiteUrl(glossaryPath ?? localizedPath("/", locale));
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        "@id": `${url}#term`,
        name,
        description: summary,
        url,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          "@id": `${localizedGlossaryUrl}#glossary`,
          name: glossaryName ?? copy.glossaryName,
          url: localizedGlossaryUrl,
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
  locale = "ko",
  path,
  homeName,
  homePath,
  categoryName,
  explorePath,
}: {
  category: MemeCategory;
  name: string;
  shortId: string;
  slug: string;
  locale?: SeoRouteLocale;
  path?: string;
  homeName?: string;
  homePath?: string;
  categoryName?: string;
  explorePath?: string;
}) {
  const copy = getSeoCopy(locale);
  const localizedHomeUrl = absoluteSiteUrl(homePath ?? localizedPath("/", locale));
  const displayCategory = resolveDisplayCategory(category);
  const localizedExploreUrl = absoluteSiteUrl(
    explorePath ?? localizedPath(`/explore?category=${displayCategory}`, locale),
  );
  const memeUrl = absoluteSiteUrl(path ?? localizedMemePath(locale, shortId, slug));
  const displayCategoryName = {
    "ai-meme": DISPLAY_CATEGORIES["ai-meme"].user,
    meme_term: copy.categories.phrase,
    challenge_dance: copy.categories.challenge,
    song: copy.categories.song,
    drama_scene: copy.categories.comment,
    meme_video: copy.categories.image,
  }[displayCategory];
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "@id": `${memeUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: homeName ?? copy.homeName,
            item: localizedHomeUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryName ?? displayCategoryName,
            item: localizedExploreUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name,
            item: memeUrl,
          },
        ],
      }}
    />
  );
}

/** Own explanatory video only: persisted public playback proof, never an origin citation. */
export function MemeProducedVideoJsonLd({ video, path }: { video: PublicMemeProducedVideo; path: string }) {
  if (video.privacy_status !== "public" || video.public_embed_verified !== true) return null;
  const metadata = parseProducedVideoMetadata(video.schema_metadata, video.youtube_video_id);
  const embedUrl = producedVideoEmbedUrl(video.youtube_video_id);
  if (!metadata || !embedUrl) return null;
  return (
    <Script data={{
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "@id": `${absoluteSiteUrl(path)}#produced-video-${video.youtube_video_id}`,
      name: metadata.name,
      ...(metadata.description ? { description: metadata.description } : {}),
      thumbnailUrl: metadata.thumbnailUrl,
      uploadDate: metadata.uploadDate,
      embedUrl,
      publisher: { "@id": `${SITE_URL}#org` },
    }} />
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
export function ExploreCollectionJsonLd({ path = "/explore" }: { path?: string } = {}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "밈 탐색",
        description:
          "카테고리·연도·난이도로 거르고 급상승·최신·인기·논쟁 순으로 전체 밈을 탐색해요.",
        url: absoluteSiteUrl(path),
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
          interactionType: { "@type": "LikeAction" },
          userInteractionCount: likeCount,
        },
        commentCount,
      }}
    />
  );
}
