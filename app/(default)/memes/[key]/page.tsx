import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CATEGORIES,
  DISPLAY_CATEGORIES,
  MODERATION_STATUS,
  formatOriginYear,
  shortIdFromParam,
  resolveDisplayCategory,
} from "@/lib/labels";
import {
  aboutSectionHeading,
  houseOriginalPublicLabel,
  isHouseOriginal,
  memeDetailMetadataDescription,
  publicOriginSectionHeading,
} from "@/lib/house-original";
import {
  getMemeByShortId,
  getReactionCounts,
  getRelatedMemes,
} from "@/lib/queries";
import { AnswerCard } from "@/components/answer-card";
import { SafetyRationale } from "@/components/safety-rationale";
import { UsageExamples } from "@/components/usage-examples";
import { MemeEmbed } from "@/components/meme-embed";
import { ReactionBar } from "@/components/reaction-bar";
import { Comments } from "@/components/comments";
import { ShareButton } from "@/components/share-button";
import {
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeWebPageJsonLd,
} from "@/components/json-ld";
import { memePathFrom } from "@/lib/labels";
import { ViewTracker } from "./view-tracker";
import { MemeCard } from "@/components/meme-card";
import { TrackedBlock } from "@/components/tracked-block";
import { ContextNav } from "@/components/context-nav";
import { SourceEvidence } from "@/components/source-evidence";
import { MemeDetailNavigation } from "@/components/meme-detail-navigation";
import { citableSources } from "@/lib/source-links";
import { parseUsageExamples } from "@/lib/usage-examples";
import { TrustNote } from "@/components/trust-note";
import { DocStatusNote } from "@/components/doc-status-note";
import { AdsenseScript } from "@/components/adsense-script";
import { isAdsenseContentEligible } from "@/lib/adsense-policy";
import { isIndexableMeme } from "@/lib/content-depth";
import { getPublicMemeMedia } from "@/lib/sources/public-links.server";
import {
  resolveMemeDelivery,
  selectSecondaryReferenceContents,
} from "@/lib/meme-delivery";
import {
  publicAnswerCardMeme,
  publicMemeEmbedContent,
  publicEditorialEligibilityInput,
  publicReaderDescription,
} from "@/lib/meme-public-detail";
import {
  getAvailableTranslationLocales,
  getLocalizedMemeByShortId,
  isIndexableLocalizedMeme,
} from "@/lib/meme-translations";
import {
  getHreflang,
  getOpenGraphLocale,
  isSeoContentLocale,
  localizedMemePath,
} from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";
import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";
import { getPublicMemeProducedVideos } from "@/lib/video-production/public.server";
import { MemeProducedVideos } from "@/components/meme-produced-videos";
import { MemeExternalTrendEvidence } from "@/components/meme-external-trend-evidence";
import { getPublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";

/** 밈 상세 문서는 요청별 SSR. React cache는 같은 요청 안의 중복 상세 조회만 제거한다. */
export const revalidate = 600;

export async function generateStaticParams(): Promise<{ key: string }[]> {
  return [];
}

type Props = { params: Promise<{ key: string }> };

async function getLocalizedVersions(memeId: string, shortId: string) {
  const availableLocales = (await getAvailableTranslationLocales(memeId)).filter(
    isSeoContentLocale,
  );
  const versions = await Promise.all(
    availableLocales.map(async (locale) => ({
      locale,
      version: await getLocalizedMemeByShortId(shortId, locale),
    })),
  );
  return versions.flatMap(({ locale, version }) =>
    version ? [{ locale, version }] : [],
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const meme = await getMemeByShortId(shortIdFromParam(key));
  // 메타데이터 단계에서 404를 확정한다. 여기서 제목만 반환하면 응답이 200으로
  // 스트리밍을 시작한 뒤라 본문의 notFound()가 상태 코드를 바꾸지 못해,
  // 없는 문서가 200 + "찾을 수 없어요" 화면(soft-404)으로 나간다 — 검색엔진이
  // 저품질 신호로 읽는다. (smoke가 /memes/zzzzzzzz 200 수신으로 검출)
  if (!meme) notFound();
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale: "ko",
  });
  if (redirectPath) redirect(redirectPath);
  const path = memePathFrom(meme.short_id, meme.slug);
  const [localizedVersions, publicMedia] = await Promise.all([
    getLocalizedVersions(meme.id, meme.short_id),
    getPublicMemeMedia(meme.meme_sources, meme.meme_contents),
  ]);
  const delivery = resolveMemeDelivery({
    contents: publicMedia.contents,
    sources: publicMedia.sources,
  });
  const publicDepthInput = publicEditorialEligibilityInput({
    meme,
    originalSources: delivery.originalSources,
    renderableContents: delivery.renderableContents,
  });
  const isPageIndexable = isIndexableMeme(publicDepthInput);
  const indexableLocalizedVersions = localizedVersions.filter(({ version }) =>
    isIndexableLocalizedMeme({
      ...version,
      description: publicReaderDescription(version.description),
      meme_sources: [...delivery.originalSources],
      meme_contents: [...delivery.renderableContents],
    }),
  );
  const languages = Object.fromEntries([
    ["ko", path],
    ...indexableLocalizedVersions.map(({ locale, version }) => [
      getHreflang(locale),
      localizedMemePath(locale, version.short_id, version.slug),
    ]),
    ["x-default", path],
  ]);
  const description = memeDetailMetadataDescription(
    meme.title,
    meme.summary,
    meme.origin_kind,
  );
  return {
    metadataBase: new URL(SITE_URL),
    // "X 뜻" 롱테일 검색 질의와 일치하는 타이틀 패턴 (템플릿이 "| 밈캐치" 부착)
    title: `${meme.title} 뜻`,
    description,
    // canonical — short_id+slug 변형 URL의 신호 분산 방지
    alternates: { canonical: path, ...(isPageIndexable ? { languages } : {}) },
    // 콘텐츠가 얇은 문서는 색인에서 뺀다(사이트맵에서도 빠짐 — lib/content-depth.ts).
    // follow는 유지 — 페이지는 200으로 살아 있고, 관련 밈·출처 링크로 크롤이 전파돼야 한다.
    ...(isPageIndexable ? {} : { robots: { index: false, follow: true } }),
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 밈별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      alternateLocale: indexableLocalizedVersions.map(({ locale }) =>
        getOpenGraphLocale(locale),
      ),
      title: `${meme.title} 뜻`,
      description,
      url: path,
    },
  };
}

export default async function MemeDetailPage({ params }: Props) {
  const { key } = await params;
  const meme = await getMemeByShortId(shortIdFromParam(key));
  if (!meme) notFound();
  const redirectPath = canonicalMemeRedirectPath(key, {
    shortId: meme.short_id,
    slug: meme.slug,
    locale: "ko",
  });
  if (redirectPath) redirect(redirectPath);
  const path = memePathFrom(meme.short_id, meme.slug);

  const tagIds = meme.meme_tags_map.map((t) => t.tag_id);
  const tagNames = meme.meme_tags_map
    .map((t) => t.tags?.name)
    .filter((n): n is string => !!n);
  const [publicMedia, related, reactionCounts, producedVideos, externalTrendEvidence] = await Promise.all([
    getPublicMemeMedia(meme.meme_sources, meme.meme_contents),
    getRelatedMemes(
      { id: meme.id, category: meme.category, origin_year: meme.origin_year },
      tagIds,
      4
    ),
    getReactionCounts(meme.id),
    getPublicMemeProducedVideos(meme.id),
    getPublicMemeTrendSummary(meme.id),
  ]);

  // 렌더 가능성 판정은 lib/content-availability.ts 하나로 모은다 — 랭킹 게이트
  // (is_meme_rank_eligible)와 같은 기준이라 "랭킹엔 못 오르는데 상세엔 뜨는"
  // 콘텐츠가 생기지 않는다.
  const delivery = resolveMemeDelivery({
    contents: publicMedia.contents,
    sources: publicMedia.sources,
  });
  const representative = delivery.representative;
  const liveContents = delivery.renderableContents;
  const originalSources = [...delivery.originalSources];
  const publicDepthInput = publicEditorialEligibilityInput({
    meme,
    originalSources: delivery.originalSources,
    renderableContents: delivery.renderableContents,
  });
  const answerCardMeme = publicAnswerCardMeme(meme);
  const readerDescription = publicReaderDescription(meme.description);
  // TikTok·Instagram 등 비대표 임베드 — 대표 영상 아래 "관련 콘텐츠"로 노출
  const relatedSocialContents = liveContents
    .filter(
      (c) =>
        c.id !== representative?.id &&
        ["tiktok", "instagram"].includes(String(c.platform ?? "").toLowerCase()),
    )
    .slice(0, 4);
  const secondaryReferenceContents = selectSecondaryReferenceContents({
    memeId: meme.id,
    contents: liveContents,
    sources: delivery.originalSources,
    representative,
  });
  const fallbackSourceUrl = delivery.fallbackSourceUrl;
  // usage_examples 컬럼·데이터는 에이전트 D가 추가 중 — DB 타입 재생성 전까지
  // 옵셔널 캐스팅 1곳으로 안전 처리(컴포넌트가 런타임 검증, 없으면 null 렌더)
  const usageExamples = (meme as typeof meme & { usage_examples?: unknown })
    .usage_examples;
  const hasUsageExamples = parseUsageExamples(usageExamples).length > 0;
  const hasCitableSources = citableSources(originalSources).length > 0;
  const hasStory = Boolean(readerDescription || meme.origin || isHouseOriginal(meme.origin_kind));

  // year_precision은 3,904건 전부 'unknown'이라 지금은 대부분 「(추정)」이 붙는다.
  // 운영자가 근거를 확인해 정밀도를 올리면 자동으로 단정 표기로 돌아간다.
  const originYearLabel = formatOriginYear(
    meme.origin_year,
    (meme as typeof meme & { year_precision?: string | null }).year_precision,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-12 sm:px-6 lg:space-y-8">
      {/*
        광고는 충실도 판정을 통과한 문서에서만 게재한다. 얇은 문서는 noindex로
        색인에서 빠지지만 사람은 여전히 도달하므로, 로더를 렌더하지 않아야
        "저품질 화면에 광고 게재"(게시자 정책 인벤토리 가치)를 피할 수 있다.
        HG-001 C안(2026-08-04): 색인(sitemap·robots) 임계값만 MIN_PROSE_CHARS_INDEX(150자)로
        낮췄다. 광고는 여기 반영하지 않고 contentDepth().isSubstantial(250자, 배너와 동일
        기준)을 그대로 쓴다 — isIndexableMeme()과 더는 같은 함수가 아니므로 기준이
        갈릴 수 있다(150~249자 문서는 색인엔 남지만 광고는 여전히 게재하지 않는다).
      */}
      {isAdsenseContentEligible(publicDepthInput) && <AdsenseScript />}
      {/* WebPage의 mainEntity는 한 줄 정의를 담은 독립 DefinedTerm의 #term ID를
          참조한다. 화면의 이동 경로와 같은 브레드크럼을 함께 출력한다.
          WebPage JSON-LD는 색인 판정과 같은 조건으로 게이트한다 — 얇은 문서(96.3%)는
          noindex인데 구조화 데이터만 완성 문서처럼 나가면 LOOP.md §10「보강 중 문서의
          metadata 과장 금지」위반이다. 브레드크럼은 탐색 관계만 서술하므로 유지. */}
      {isIndexableMeme(publicDepthInput) && (
        <>
          <MemeWebPageJsonLd
            name={meme.title}
            summary={meme.summary}
            description={readerDescription}
            shortId={meme.short_id}
            slug={meme.slug}
            datePublished={meme.published_at}
            dateModified={meme.updated_at}
            sources={originalSources}
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
      <nav aria-label="이동 경로" className="flex flex-wrap gap-x-2 text-sm text-muted">
        <Link href="/" className="underline-offset-4 hover:underline">밈캐치</Link>
        <span aria-hidden>/</span>
        <Link href={`/explore?category=${resolveDisplayCategory(meme.category)}`} className="underline-offset-4 hover:underline">
          {DISPLAY_CATEGORIES[resolveDisplayCategory(meme.category)].user}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{meme.title}</span>
      </nav>
      <ViewTracker memeId={meme.id} />

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
      <AnswerCard meme={answerCardMeme} saveMemeId={meme.id}
        actions={<ShareButton path={path} title={meme.title} label="공유" />} />

      <MemeDetailNavigation
        label="밈 내용 바로가기"
        items={[
          ...(hasUsageExamples ? [{ id: "meme-examples", label: "사용 예시" }] : []),
          { id: "meme-media", label: "영상·이미지" },
          ...(hasStory ? [{ id: "meme-story", label: aboutSectionHeading(meme.origin_kind) }] : []),
          ...(hasCitableSources ? [{ id: "meme-sources", label: "참고 자료" }] : []),
        ]}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
        <div className="min-w-0 space-y-7 break-words lg:order-2">
          <DocStatusNote meme={publicDepthInput} title={meme.title} shortId={meme.short_id} />
          <MemeExternalTrendEvidence evidence={externalTrendEvidence} />
          {hasUsageExamples && (
            <div id="meme-examples" tabIndex={-1} className="scroll-mt-28 rounded-2xl bg-surface-2/70 p-5 sm:p-6">
              <UsageExamples examples={usageExamples} />
            </div>
          )}
          <SafetyRationale
            level={meme.safety_level}
            sentiment={meme.sentiment}
            context={meme.usage_context}
            note={meme.usage_note}
            caution={meme.caution}
            reviewedAt={meme.safety_reviewed_at}
          />

          {hasStory && (
            <details id="meme-story" tabIndex={-1} className="scroll-mt-28 rounded-2xl border border-border px-5 sm:px-6">
              <summary className="min-h-11 cursor-pointer py-5 text-lg font-bold tracking-tight focus-visible:outline-offset-4">
                {aboutSectionHeading(meme.origin_kind)}
              </summary>
              <div className="max-w-[65ch] space-y-6 pb-6 text-base leading-8">
                {readerDescription && (
                  <div>
                    <h2 className="font-semibold">무슨 뜻이에요?</h2>
                    <p className="mt-2 whitespace-pre-line text-foreground/90">{readerDescription}</p>
                  </div>
                )}
                {(meme.origin || isHouseOriginal(meme.origin_kind)) && (
                  <div>
                    <h2 className="font-semibold">{publicOriginSectionHeading(meme.origin_kind)}</h2>
                    {isHouseOriginal(meme.origin_kind) && (
                      <p className="mt-2 font-semibold">{houseOriginalPublicLabel()}</p>
                    )}
                    {meme.origin ? <p className="mt-2 whitespace-pre-line text-foreground/90">{meme.origin}</p> : null}
                  </div>
                )}
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{CATEGORIES[meme.category].user}</span>
                  {originYearLabel && <span>{originYearLabel}</span>}
                  {tagNames.map((name) => <span key={name}>#{name}</span>)}
                </p>
                <TrustNote
                  sources={originalSources}
                  updatedAt={meme.updated_at}
                  moderationStatus={meme.moderation_status}
                  title={meme.title}
                  shortId={meme.short_id}
                  originKind={meme.origin_kind}
                />
              </div>
            </details>
          )}
          {hasCitableSources && (
            <div id="meme-sources" tabIndex={-1} className="scroll-mt-28">
              <SourceEvidence sources={originalSources} shortId={meme.short_id} />
            </div>
          )}
          <details className="border-t border-border">
            <summary className="min-h-11 cursor-pointer py-4 font-semibold focus-visible:outline-offset-4">댓글 보기</summary>
            <Comments memeId={meme.id} />
          </details>
        </div>

        <div className="min-w-0 space-y-4 lg:order-1">
          <section id="meme-media" tabIndex={-1} className="scroll-mt-28 space-y-3" aria-label={(representative?.is_representative ?? true) ? "대표 콘텐츠" : "관련 콘텐츠"}>
            <h2 className="text-lg font-bold tracking-tight">콘텐츠로 이해하기</h2>
            <MemeEmbed
              content={publicMemeEmbedContent(representative)}
              fallbackSourceUrl={fallbackSourceUrl}
              fallbackReason={delivery.fallbackReason}
              title={meme.title}
              isRepresentative={representative?.is_representative ?? true}
              category={meme.category}
              originYear={meme.origin_year}
            />
          </section>
          <details className="border-t border-border">
            <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted focus-visible:outline-offset-4">반응 남기기</summary>
            <ReactionBar memeId={meme.id} initialCounts={reactionCounts} />
          </details>

          {relatedSocialContents.length > 0 && (
            <details className="border-t border-border pt-2">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-offset-4">
                다른 사용 영상 {relatedSocialContents.length}개
              </summary>
              <p className="mb-3 text-sm text-muted">원본이 아닌 관련 사용 예시입니다.</p>
              <div className="grid gap-4">
                {relatedSocialContents.map((content) => (
                  <MemeEmbed
                    key={content.id}
                    content={publicMemeEmbedContent(content)}
                    title={meme.title}
                    isRepresentative={false}
                  />
                ))}
              </div>
            </details>
          )}
          {secondaryReferenceContents.length > 0 && (
            <section aria-labelledby="secondary-reference-title" className="border-t border-border pt-4">
              <h2 id="secondary-reference-title" className="text-lg font-bold">검수된 참고 영상</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                이해를 돕는 보조 자료이며, 챌린지 원본이나 독립 확산 근거가 아닙니다.
              </p>
              <div className="mt-3 grid gap-4">
                {secondaryReferenceContents.map((content) => (
                  <MemeEmbed
                    key={content.id}
                    content={publicMemeEmbedContent(content)}
                    title={meme.title}
                    isRepresentative={false}
                  />
                ))}
              </div>
            </section>
          )}
          <MemeProducedVideos videos={producedVideos} memeTitle={meme.title}
            structuredDataPath={isIndexableMeme(publicDepthInput) ? path : undefined} />
        </div>

      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-memes-title" className="border-t border-border pt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 id="related-memes-title" className="text-lg font-bold">비슷한 밈</h2>
            <Link href="/explore" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground">전체 보기 →</Link>
          </div>
          <TrackedBlock event="next_meme_click" className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((item) => <MemeCard key={item.id} meme={item} />)}
          </TrackedBlock>
        </section>
      )}
    </main>
  );
}
