import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  CATEGORIES,
  MODERATION_STATUS,
  formatOriginYear,
} from "@/lib/labels";
import {
  aboutSectionHeading,
  houseOriginalPublicLabel,
  isHouseOriginal,
  memeDetailMetadataDescription,
  originSectionHeading,
} from "@/lib/house-original";
import {
  getReactionCounts,
  getRelatedMemes,
} from "@/lib/queries";
import { AnswerCard } from "@/components/answer-card";
import { SafetyRationale } from "@/components/safety-rationale";
import { PlusPricingHashScroll } from "@/components/plus-pricing-hash-scroll";
import { UsageExamples } from "@/components/usage-examples";
import { MemeTrendPanel } from "@/components/premium/meme-trend-panel";
import { MemeUseKit } from "@/components/premium/meme-use-kit";
import { MemeMarketPassport } from "@/components/meme-market-passport";
import { MeteredGate } from "@/components/metered-gate";
import { AuthInvite } from "@/components/auth-invite";
import { MemeEmbed } from "@/components/meme-embed";
import { ReactionBar } from "@/components/reaction-bar";
import { Comments } from "@/components/comments";
import { ExportButton } from "@/components/export-button";
import { ShareButton } from "@/components/share-button";
import {
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeWebPageJsonLd,
} from "@/components/json-ld";
import { usageRegionLabelledBy } from "@/lib/detail-usage";
import { memePathFrom } from "@/lib/labels";
import { DonateCard } from "@/components/donate-card";
import { ViewTracker } from "./view-tracker";
import { ContinueStream } from "@/components/continue-stream";
import { ContextNav } from "@/components/context-nav";
import { SourceEvidence } from "@/components/source-evidence";
import { TrustNote } from "@/components/trust-note";
import { DocStatusNote } from "@/components/doc-status-note";
import { MemeLifecycleGuide } from "@/components/meme-lifecycle-guide";
import { AdsenseScript } from "@/components/adsense-script";
import { isAdsenseContentEligible } from "@/lib/adsense-policy";
import { isIndexableMeme } from "@/lib/content-depth";
import { isRenderableContent } from "@/lib/content-availability";
import { resolveMemeDelivery } from "@/lib/meme-delivery";
import {
  getAvailableTranslationLocales,
  getLocalizedMemeByShortId,
} from "@/lib/meme-translations";
import {
  getHreflang,
  getOpenGraphLocale,
  isSeoContentLocale,
  localizedMemePath,
} from "@/lib/i18n-routing";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { koreanMemeShareImage } from "@/lib/meme-share-image";
import { SITE_URL } from "@/lib/site";
import { getMemeMarketPassport } from "@/lib/meme-market-passport.server";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";
import { findCuratedCoreMeme } from "@/lib/curated-memes";
import { CuratedMemeArticle } from "@/components/curated-meme-article";
import { MemeCatalogUnavailable } from "@/components/meme-catalog-unavailable";
import {
  curatedMemeMetadata,
  resolveKoreanMemeDocument,
  unavailableMemeMetadata,
} from "@/lib/public-meme-document";

/**
 * 요청마다 렌더한다. 이 라우트를 ISR로 두고 요청 대기를 걸면 프로덕션이
 * DYNAMIC_SERVER_USAGE 500을 낸다. 카탈로그 오류는 200, 확인된 결측은
 * notFound()의 404, 성공은 본문이다. 그 결과를 하루짜리 정적 결과로 남기지 않는다.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const resolved = await resolveKoreanMemeDocument(key);
  if (resolved.kind === "curated") return curatedMemeMetadata(resolved.meme);
  if (resolved.kind === "unavailable") return unavailableMemeMetadata();
  const meme = resolved.kind === "database" ? resolved.meme : null;
  const requestedShortId = resolved.requestedShortId;
  const targetShortId = resolved.targetShortId;
  // 조회가 성공하고 행이 없을 때만 404다. 카탈로그 오류는 위에서 빠진다.
  // 메타데이터 단계에서 404를 확정한다. 여기서 제목만 반환하면 응답이 200으로
  // 스트리밍을 시작한 뒤라 본문의 notFound()가 상태 코드를 바꾸지 못해,
  // 없는 문서가 200 + "찾을 수 없어요" 화면(soft-404)으로 나간다 — 검색엔진이
  // 저품질 신호로 읽는다. (smoke가 /memes/zzzzzzzz 200 수신으로 검출)
  if (!meme) notFound();

  // 중복 밈 별칭인 경우 대표 권위 URL로 301 영구 리디렉션
  if (targetShortId !== requestedShortId) {
    permanentRedirect(memePathFrom(meme.short_id, meme.slug));
  }
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale: "ko",
  });
  if (redirectPath) permanentRedirect(redirectPath);
  const path = memePathFrom(meme.short_id, meme.slug);
  const availableLocales = (await getAvailableTranslationLocales(meme.id)).filter(
    isSeoContentLocale,
  );
  const localizedVersions = (
    await Promise.all(
      availableLocales.map(async (locale) => ({
        locale,
        version: await getLocalizedMemeByShortId(meme.short_id, locale),
      })),
    )
  ).flatMap(({ locale, version }) =>
    version ? [{ locale, version }] : [],
  );
  const hreflangs: Record<string, string> = Object.fromEntries([
    ["ko", path],
    ...localizedVersions.map(({ locale, version }) => [
      getHreflang(locale),
      localizedMemePath(
        locale,
        version.short_id,
        version.slug,
      ),
    ]),
  ]);
  // 해외 주 타깃 전환: x-default는 영어 문서. en 번역이 없으면 ko 원문 유지
  // (존재하지 않는 /en URL을 가리키면 유해).
  const languages = { ...hreflangs, "x-default": hreflangs.en ?? path };
  const description = memeDetailMetadataDescription(
    meme.title,
    meme.summary,
    meme.origin_kind,
  );
  const image = koreanMemeShareImage(meme.short_id, meme.slug, meme.title);
  return {
    metadataBase: new URL(SITE_URL),
    // "X 뜻" 롱테일 검색 질의와 일치하는 타이틀 패턴 (템플릿이 "| 밈캐치" 부착)
    title: `${meme.title} 뜻`,
    description,
    // canonical — short_id+slug 변형 URL의 신호 분산 방지
    alternates: { canonical: path, languages },
    // 콘텐츠가 얇은 문서는 색인에서 뺀다(사이트맵에서도 빠짐 — lib/content-depth.ts).
    // follow는 유지 — 페이지는 200으로 살아 있고, 관련 밈·출처 링크로 크롤이 전파돼야 한다.
    ...(isIndexableMeme(meme) ? {} : { robots: { index: false, follow: true } }),
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 밈별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      alternateLocale: localizedVersions.map(({ locale }) =>
        getOpenGraphLocale(locale),
      ),
      title: `${meme.title} 뜻`,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${meme.title} 뜻`,
      description,
      images: [image],
    },
  };
}

function koreanAdFreePlus() {
  const feature = PREMIUM_COPY.ko.pricing.features.find(
    (item) => item.label === "광고 없는 경험",
  );
  if (!feature) {
    throw new Error("Korean Plus pricing is missing the ad-free benefit");
  }
  return feature;
}

function KoreanPlusPricingCard({ titleId }: { titleId: string }) {
  const feature = koreanAdFreePlus();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-accent/25 bg-accent-soft/20 p-4"
    >
      <h2 id={titleId} className="text-lg font-black">
        {feature.label}
      </h2>
      <p className="mt-1 text-sm leading-relaxed">{feature.detail}</p>
      <Link
        href="/pricing"
        data-plus-pricing-cta
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white"
      >
        {PREMIUM_COPY.ko.dashboard.viewPlans}
      </Link>
    </section>
  );
}

export default async function MemeDetailPage({ params }: Props) {
  const { key } = await params;
  const resolved = await resolveKoreanMemeDocument(key);
  if (resolved.kind === "curated") return <CuratedMemeArticle meme={resolved.meme} />;
  if (resolved.kind === "unavailable") return <MemeCatalogUnavailable />;
  const meme = resolved.kind === "database" ? resolved.meme : null;
  const requestedShortId = resolved.requestedShortId;
  const targetShortId = resolved.targetShortId;
  if (!meme) notFound();

  if (targetShortId !== requestedShortId) {
    permanentRedirect(memePathFrom(meme.short_id, meme.slug));
  }

  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale: "ko",
  });
  if (redirectPath) permanentRedirect(redirectPath);
  const path = memePathFrom(meme.short_id, meme.slug);

  const tagIds = meme.meme_tags_map.map((t) => t.tag_id);
  const storedTagNames = meme.meme_tags_map
    .map((t) => t.tags?.name)
    .filter((n): n is string => !!n);
  const tagNames = storedTagNames.length > 0
    ? storedTagNames
    : findCuratedCoreMeme(meme.short_id)?.tags ?? [];
  const [related, reactionCounts, marketPassport] = await Promise.all([
    // 상세 하단은 관련 밈 카드를 최대 6장까지 둔다.
    getRelatedMemes(
      { id: meme.id, category: meme.category, origin_year: meme.origin_year },
      tagIds,
      6
    ),
    getReactionCounts(meme.id),
    getMemeMarketPassport(meme.id, "ko"),
  ]);

  // 렌더 가능성 판정은 lib/content-availability.ts 하나로 모은다 — 랭킹 게이트
  // (is_meme_rank_eligible)와 같은 기준이라 "랭킹엔 못 오르는데 상세엔 뜨는"
  // 콘텐츠가 생기지 않는다.
  const delivery = resolveMemeDelivery({
    contents: meme.meme_contents,
    sources: meme.meme_sources,
  });
  const representative = delivery.representative;
  const liveContents = meme.meme_contents.filter(isRenderableContent);
  // TikTok·Instagram 등 비대표 임베드 — 대표 영상 아래 "관련 콘텐츠"로 노출
  const relatedSocialContents = liveContents
    .filter(
      (c) =>
        c.id !== representative?.id &&
        ["tiktok", "instagram"].includes(String(c.platform ?? "").toLowerCase()),
    )
    .slice(0, 4);
  const sourceLinks = delivery.sourceLinks;
  const fallbackSourceUrl = delivery.fallbackSourceUrl;
  // usage_examples 컬럼·데이터는 에이전트 D가 추가 중 — DB 타입 재생성 전까지
  // 옵셔널 캐스팅 1곳으로 안전 처리(컴포넌트가 런타임 검증, 없으면 null 렌더)
  const usageExamples = (meme as typeof meme & { usage_examples?: unknown })
    .usage_examples;
  const usageLabel = usageRegionLabelledBy(
    Boolean(meme.usage_note),
    Array.isArray(usageExamples) && usageExamples.length > 0,
  );

  // year_precision은 3,904건 전부 'unknown'이라 지금은 대부분 「(추정)」이 붙는다.
  // 운영자가 근거를 확인해 정밀도를 올리면 자동으로 단정 표기로 돌아간다.
  const originYearLabel = formatOriginYear(
    meme.origin_year,
    (meme as typeof meme & { year_precision?: string | null }).year_precision,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-14">
      <PlusPricingHashScroll />
      {/*
        광고는 충실도 판정을 통과한 문서에서만 게재한다. 얇은 문서는 noindex로
        색인에서 빠지지만 사람은 여전히 도달하므로, 로더를 렌더하지 않아야
        "저품질 화면에 광고 게재"(게시자 정책 인벤토리 가치)를 피할 수 있다.
        HG-001 C안(2026-08-04): 색인(sitemap·robots) 임계값만 MIN_PROSE_CHARS_INDEX(150자)로
        낮췄다. 광고는 여기 반영하지 않고 contentDepth().isSubstantial(250자, 배너와 동일
        기준)을 그대로 쓴다 — isIndexableMeme()과 더는 같은 함수가 아니므로 기준이
        갈릴 수 있다(150~249자 문서는 색인엔 남지만 광고는 여전히 게재하지 않는다).
      */}
      {isAdsenseContentEligible(meme) && <AdsenseScript />}
      {/* GEO: WebPage(날짜·speakable) + mainEntity DefinedTerm(중첩) + 독립 최상위
          DefinedTerm(사전 항목) + 브레드크럼. 독립 DefinedTerm은 mainEntity를
          대체하지 않는 병렬 블록 — components/json-ld.tsx MemeDefinedTermJsonLd 참고.
          WebPage JSON-LD는 색인 판정과 같은 조건으로 게이트한다 — 얇은 문서(96.3%)는
          noindex인데 구조화 데이터만 완성 문서처럼 나가면 LOOP.md §10「보강 중 문서의
          metadata 과장 금지」위반이다. 브레드크럼은 탐색 관계만 서술하므로 유지. */}
      {isIndexableMeme(meme) && (
        <>
          <MemeWebPageJsonLd
            name={meme.title}
            summary={meme.summary}
            description={meme.description}
            shortId={meme.short_id}
            slug={meme.slug}
            datePublished={meme.published_at}
            dateModified={meme.updated_at}
            sources={meme.meme_sources}
          />
          <MemeDefinedTermJsonLd
            name={meme.title}
            summary={meme.summary}
            shortId={meme.short_id}
            slug={meme.slug}
          />
        </>
      )}
      <MemeBreadcrumbJsonLd
        category={meme.category}
        name={meme.title}
        shortId={meme.short_id}
        slug={meme.slug}
      />
      <ViewTracker memeId={meme.id} />
      {/* 미터링 게이트 — 서버는 동일 HTML을 주고 방문자 본인 기록으로만 판단(클로킹 아님) */}
      <MeteredGate memeId={meme.id} />

      {/* 컬렉션 진입 맥락 네비 — 최신 searchParams를 읽기 위해 클라이언트에서 처리 */}
      <ContextNav />

      {meme.moderation_status === "limited" && (
        <p
          role="status"
          className="flex min-h-11 items-center gap-2 rounded-xl bg-safety-yellow-bg px-4 py-2.5 text-base font-semibold text-safety-yellow"
        >
          <span aria-hidden>▲</span>
          {MODERATION_STATUS.limited.user} · 정보가 바뀔 수 있어요.
        </p>
      )}

      {/* 정답 카드를 2단 그리드 **위**로 올린다.
          모바일에서는 그리드가 세로로 풀리면서 왼쪽 레일(대표 영상 662px)이 통째로
          정보 앞에 왔고, 그 결과 h1이 1399px·정답 카드가 1344px 아래에 있었다 —
          첫 뷰포트(844px)에 이 밈의 뜻과 신호가 하나도 없었다는 뜻이다.
          카드를 그리드 밖으로 빼면 모바일은 "뜻 먼저, 영상 나중"(LOOP.md 정보 계층)이
          되고 데스크톱은 제목이 전체 폭을 쓰는 헤더가 된다. 2단 구조 자체는 그대로다. */}
      <div className="space-y-3">
        <AnswerCard meme={meme} saveMemeId={meme.id} />
        <div className="flex justify-end">
          <ShareButton path={path} title={meme.title} label="공유" />
        </div>
      </div>

      {/* 감상(좌)·정보(우) 2단.
          왼쪽 레일은 페이지와 함께 스크롤한다. 레일 전체를 고정하면 1280×800에서
          Plus 카드가 뷰포트 아래(top ≈ 1028px)에 머물러 스크롤해도 다 보이지 않는다.
          모바일은 정답 카드 다음에 영상, 그다음 나머지 정보가 이어진다. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        {/* 왼쪽 레일 — 영상/SNS + 감상 액션(반응·저장) + 데스크톱 Plus 카드. */}
        <div className="space-y-4">
          {/* 렌더 가능한 콘텐츠가 하나도 없으면(폴백 히어로) 이 자리는 여전히 이 밈의
              대표 미디어 슬롯이다. 아래 MemeEmbed의 isRepresentative와 같은 식을 써서
              라벨과 컴포넌트 판정이 갈리지 않게 한다. */}
          <section
            aria-label={
              (representative?.is_representative ?? true) ? "대표 콘텐츠" : "관련 콘텐츠"
            }
          >
            <MemeEmbed
              content={representative}
              fallbackSourceUrl={fallbackSourceUrl}
              fallbackReason={delivery.fallbackReason}
              title={meme.title}
              isRepresentative={representative?.is_representative ?? true}
              category={meme.category}
              originYear={meme.origin_year}
              originKind={meme.origin_kind}
              summary={meme.summary}
            />
          </section>

          <ReactionBar memeId={meme.id} initialCounts={reactionCounts} />
          <ExportButton shortId={meme.short_id} />

          <div className="scroll-mt-28 hidden lg:block" data-plus-pricing-slot="rail">
            <KoreanPlusPricingCard titleId="plus-pricing-title" />
          </div>

          {/* 관련 TikTok·Instagram — 대표 아래 공개 사용 예시(비대표 임베드) */}
          {relatedSocialContents.length > 0 && (
            <section aria-labelledby="related-social-embeds" className="space-y-3">
              <h2 id="related-social-embeds" className="text-lg font-bold">
                관련 TikTok·Instagram
              </h2>
              <p className="text-sm text-muted">
                원본 단정이 아닌 공개 사용 예시예요. 권리·맥락은 출처에서 확인하세요.
              </p>
              <div className="grid gap-4">
                {relatedSocialContents.map((content) => (
                  <MemeEmbed
                    key={content.id}
                    content={content}
                    title={meme.title}
                    isRepresentative={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 오른쪽 — 정보. */}
        <div className="mt-6 min-w-0 space-y-5 lg:mt-0">
          {/* 정리 중 안내 — content-depth가 '얇음'으로 본 문서에만. 방치된 스텁이 아니라
              확인된 만큼만 공개하는 관리 문서임을 밝히고 제보 경로를 연다.
              충실도 판정은 generateMetadata의 robots와 같은 입력(meme)을 쓴다. */}
          <DocStatusNote meme={meme} title={meme.title} shortId={meme.short_id} />

          {meme.description && (
            <section aria-labelledby="meme-meaning" data-detail-order="meaning">
              <h2 id="meme-meaning" className="text-lg font-bold [word-break:keep-all]">뜻</h2>
              <p data-korean-body="" className="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]">
                {meme.description}
              </p>
            </section>
          )}

          {usageLabel && (
            <section aria-labelledby={usageLabel} data-detail-order="usage" className="space-y-4">
              {meme.usage_note ? (
                <div>
                  <h2 id="meme-usage" className="text-lg font-bold [word-break:keep-all]">이렇게 써요</h2>
                  <p data-korean-body="" className="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]">
                    {meme.usage_note}
                  </p>
                </div>
              ) : null}
              <UsageExamples examples={usageExamples} heading={!meme.usage_note} />
            </section>
          )}

          {meme.caution ? (
            <section aria-labelledby="meme-caution" data-detail-order="caution">
              <h2 id="meme-caution" className="text-lg font-bold [word-break:keep-all]">쓰면 안 되는 상황</h2>
              <p data-korean-body="" className="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]">
                {meme.caution}
              </p>
            </section>
          ) : null}

          {(meme.origin || isHouseOriginal(meme.origin_kind)) && (
            <section aria-labelledby="meme-origin" data-detail-order="origin">
              <h2 id="meme-origin" className="text-lg font-bold [word-break:keep-all]">
                {isHouseOriginal(meme.origin_kind) ? originSectionHeading(meme.origin_kind) : "유래"}
              </h2>
              {isHouseOriginal(meme.origin_kind) && (
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {houseOriginalPublicLabel()}
                </p>
              )}
              {meme.origin ? (
                <p data-korean-body="" className="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]">
                  {meme.origin}
                </p>
              ) : null}
            </section>
          )}

          <div data-detail-order="related">
            <ContinueStream
              currentId={meme.id}
              category={meme.category}
              related={related}
            />
          </div>

          <section
            aria-labelledby="meme-about"
            data-detail-order="sources"
            className="glass-panel relative overflow-hidden rounded-2xl p-5"
          >
            <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
            <div className="relative space-y-4">
              <h2 id="meme-about" className="sr-only">
                {aboutSectionHeading(meme.origin_kind)}
              </h2>
              <h2 className="text-lg font-bold [word-break:keep-all]">출처</h2>
              {meme.content_reviewed_at && (
                <p className="text-sm text-muted">
                  최종 검토일:{" "}
                  <time dateTime={meme.content_reviewed_at}>
                    {new Intl.DateTimeFormat("ko-KR", {
                      timeZone: "Asia/Seoul",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }).format(new Date(meme.content_reviewed_at))}
                  </time>
                </p>
              )}

                {/* 분류·시기·태그 — 유래 유무와 무관하게 이 밈이 가진 실제 메타데이터라
                    origin이 비어도 노출한다(있는 정보를 숨기지 않는다). */}
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium">
                    {CATEGORIES[meme.category].user}
                  </span>
                  {/* 연도는 정밀도와 함께 읽는다 — year_precision이 근거를 뒷받침하지
                      못하면 「(추정)」을 붙여 단정하지 않는다. */}
                  {originYearLabel && (
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium">
                      {originYearLabel}
                    </span>
                  )}
                  {tagNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-surface-2 px-2.5 py-1 font-medium"
                    >
                      #{name}
                    </span>
                  ))}
                </p>

                {/* 상시 출처 인용 — E-E-A-T: 본문 주장 바로 아래에 근거 링크.
                    모노 인덱스 스타일 — 관제 화면의 계측 라벨 문법(stat-mono 어휘)과 통일. */}
                {sourceLinks.length > 0 && (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-muted">
                    <span className="font-semibold uppercase tracking-[0.1em]">출처</span>
                    {sourceLinks.slice(0, 3).map((s, i) => (
                      <a
                        key={s.source_url ?? i}
                        href={s.source_url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-6 items-center gap-1 underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
                      >
                        <span aria-hidden className="tabular-nums text-muted/70">
                          0{i + 1}
                        </span>
                        {s.source_url?.includes("namu.wiki")
                          ? "나무위키"
                          : s.platform || "원문"}
                        <span aria-hidden className="text-xs">↗</span>
                      </a>
                    ))}
                  </p>
                )}
                {/* 신뢰 신호 — 근거가 있는 만큼만 말한다. meme_sources만 넘긴다:
                    sourceLinks에는 재생용 콘텐츠 URL이 섞여 있어 근거 수를 부풀린다. */}
                <TrustNote
                  sources={meme.meme_sources}
                  updatedAt={meme.updated_at}
                  moderationStatus={meme.moderation_status}
                  title={meme.title}
                  shortId={meme.short_id}
                  originKind={meme.origin_kind}
                />
              </div>
            </section>

          <AuthInvite />

          <MemeUseKit
            title={meme.title}
            summary={meme.summary}
            usageNote={meme.usage_note}
            caution={meme.caution}
            safetyLevel={meme.safety_level}
            lifecycleStatus={meme.lifecycle_status}
          />

          <MemeMarketPassport passport={marketPassport} locale="ko" />

          {/* 참고 자료 근거 목록 — 제목 있는 출처가 하나도 없으면 렌더하지 않는다.
              유래 아래 인라인 링크와 달리 무엇을 근거로 삼았는지 펼쳐 보인다. */}
          <SourceEvidence sources={meme.meme_sources} shortId={meme.short_id} />

          <div className="lg:hidden scroll-mt-28" data-plus-pricing-slot="after-sources">
            <KoreanPlusPricingCard titleId="plus-pricing-title-mobile" />
          </div>

          <div data-detail-order="appendix" className="space-y-5">
            <SafetyRationale
              level={meme.safety_level}
              sentiment={meme.sentiment}
              context={meme.usage_context}
              note={meme.usage_note}
              caution={meme.caution}
              reviewedAt={meme.safety_reviewed_at}
            />
            <MemeLifecycleGuide
              lifecycleStatus={meme.lifecycle_status}
              originYear={meme.origin_year}
              title={meme.title}
            />
          </div>

          {/* Plus 트렌드 추이 — 이 페이지의 SSG를 지키려고 서버에서 구독을 읽지 않는다.
              권한 검사·데이터 제공은 클라이언트가 호출하는 /api/memes/[id]/trend가 담당. */}
          <MemeTrendPanel memeId={meme.id} />

          <Comments memeId={meme.id} />

          {/* 후원 — 본문·반응을 거친 고관여 지점에 절제된 1개 CTA(1인 운영 비영리) */}
          <DonateCard />
        </div>
      </div>

    </main>
  );
}
