import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  MODERATION_STATUS,
  formatOriginYear,
  shortIdFromParam,
} from "@/lib/labels";
import {
  getMemeByShortId,
  getReactionCounts,
  getRelatedMemes,
} from "@/lib/queries";
import { AnswerCard } from "@/components/answer-card";
import { SafetyRationale } from "@/components/safety-rationale";
import { UsageExamples } from "@/components/usage-examples";
import { MemeTrendPanel } from "@/components/premium/meme-trend-panel";
import { MeteredGate } from "@/components/metered-gate";
import { AuthInvite } from "@/components/auth-invite";
import { MemeEmbed } from "@/components/meme-embed";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import { ReactionBar } from "@/components/reaction-bar";
import { Comments } from "@/components/comments";
import { SaveButton } from "@/components/save-button";
import { ExportButton } from "@/components/export-button";
import {
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeVideoJsonLd,
  MemeWebPageJsonLd,
} from "@/components/json-ld";
import { memePathFrom } from "@/lib/labels";
import { DonateCard } from "@/components/donate-card";
import { ViewTracker } from "./view-tracker";
import { ContinueStream } from "@/components/continue-stream";
import { ContextNav } from "@/components/context-nav";
import { preferredSourceUrl, sourceLinksWithContent } from "@/lib/source-links";
import { SourceEvidence } from "@/components/source-evidence";
import { TrustNote } from "@/components/trust-note";
import { DocStatusNote } from "@/components/doc-status-note";
import { AdsenseScript } from "@/components/adsense-script";
import { contentDepth, isIndexableMeme } from "@/lib/content-depth";
import { isRenderableContent } from "@/lib/content-availability";
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

/** 밈 상세 문서는 요청별 SSR. React cache는 같은 요청 안의 중복 상세 조회만 제거한다. */
export const revalidate = 600;

export async function generateStaticParams(): Promise<{ key: string }[]> {
  return [];
}

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const meme = await getMemeByShortId(shortIdFromParam(key));
  // 메타데이터 단계에서 404를 확정한다. 여기서 제목만 반환하면 응답이 200으로
  // 스트리밍을 시작한 뒤라 본문의 notFound()가 상태 코드를 바꾸지 못해,
  // 없는 문서가 200 + "찾을 수 없어요" 화면(soft-404)으로 나간다 — 검색엔진이
  // 저품질 신호로 읽는다. (smoke가 /memes/zzzzzzzz 200 수신으로 검출)
  if (!meme) notFound();
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
  const languages = Object.fromEntries([
    ["ko", path],
    ...localizedVersions.map(({ locale, version }) => [
      getHreflang(locale),
      localizedMemePath(
        locale,
        version.short_id,
        version.slug,
      ),
    ]),
    ["x-default", path],
  ]);
  const description = `${meme.title} 뜻과 유래 — ${meme.summary}. 지금 써도 되는지 사용 안전 신호등까지 확인하세요.`;
  return {
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
    },
  };
}

export default async function MemeDetailPage({ params }: Props) {
  const { key } = await params;
  const meme = await getMemeByShortId(shortIdFromParam(key));
  if (!meme) notFound();

  const tagIds = meme.meme_tags_map.map((t) => t.tag_id);
  const tagNames = meme.meme_tags_map
    .map((t) => t.tags?.name)
    .filter((n): n is string => !!n);
  const [related, reactionCounts] = await Promise.all([
    // 첫 화면 링크 수를 줄이려 6개만 — 나머지 탐색은 하단 무한 스크롤이 담당한다.
    getRelatedMemes(
      { id: meme.id, category: meme.category, origin_year: meme.origin_year },
      tagIds,
      6
    ),
    getReactionCounts(meme.id),
  ]);

  // 렌더 가능성 판정은 lib/content-availability.ts 하나로 모은다 — 랭킹 게이트
  // (is_meme_rank_eligible)와 같은 기준이라 "랭킹엔 못 오르는데 상세엔 뜨는"
  // 콘텐츠가 생기지 않는다.
  const liveContents = meme.meme_contents.filter(isRenderableContent);
  const representative =
    liveContents.find((c) => c.is_representative) ?? liveContents[0] ?? null;
  // TikTok·Instagram 등 비대표 임베드 — 대표 영상 아래 "관련 콘텐츠"로 노출
  const relatedSocialContents = liveContents
    .filter(
      (c) =>
        c.id !== representative?.id &&
        ["tiktok", "instagram"].includes(String(c.platform ?? "").toLowerCase()),
    )
    .slice(0, 4);
  const sourceLinks = sourceLinksWithContent(meme.meme_sources, meme.meme_contents);
  const fallbackSourceUrl = preferredSourceUrl(sourceLinks);
  // usage_examples 컬럼·데이터는 에이전트 D가 추가 중 — DB 타입 재생성 전까지
  // 옵셔널 캐스팅 1곳으로 안전 처리(컴포넌트가 런타임 검증, 없으면 null 렌더)
  const usageExamples = (meme as typeof meme & { usage_examples?: unknown })
    .usage_examples;

  // year_precision은 3,904건 전부 'unknown'이라 지금은 대부분 「(추정)」이 붙는다.
  // 운영자가 근거를 확인해 정밀도를 올리면 자동으로 단정 표기로 돌아간다.
  const originYearLabel = formatOriginYear(
    meme.origin_year,
    (meme as typeof meme & { year_precision?: string | null }).year_precision,
  );

  const representativePlatform = sourcePlatformFromReference({
    platform: representative?.platform,
    url: representative?.url,
  });
  const isYouTubeRep =
    (representativePlatform === "youtube" ||
      representativePlatform === "youtube_shorts") &&
    !!representative?.content_id;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-14">
      {/*
        광고는 충실도 판정을 통과한 문서에서만 게재한다. 얇은 문서는 noindex로
        색인에서 빠지지만 사람은 여전히 도달하므로, 로더를 렌더하지 않아야
        "저품질 화면에 광고 게재"(게시자 정책 인벤토리 가치)를 피할 수 있다.
        HG-001 C안(2026-08-04): 색인(sitemap·robots) 임계값만 MIN_PROSE_CHARS_INDEX(150자)로
        낮췄다. 광고는 여기 반영하지 않고 contentDepth().isSubstantial(250자, 배너와 동일
        기준)을 그대로 쓴다 — isIndexableMeme()과 더는 같은 함수가 아니므로 기준이
        갈릴 수 있다(150~249자 문서는 색인엔 남지만 광고는 여전히 게재하지 않는다).
      */}
      {contentDepth(meme).isSubstantial && <AdsenseScript />}
      {/* GEO: WebPage(날짜·speakable) + mainEntity DefinedTerm(중첩) + 독립 최상위
          DefinedTerm(사전 항목) + 브레드크럼 + 대표영상. 독립 DefinedTerm은 mainEntity를
          대체하지 않는 병렬 블록 — components/json-ld.tsx MemeDefinedTermJsonLd 참고.
          WebPage JSON-LD는 색인 판정과 같은 조건으로 게이트한다 — 얇은 문서(96.3%)는
          noindex인데 구조화 데이터만 완성 문서처럼 나가면 LOOP.md §10「보강 중 문서의
          metadata 과장 금지」위반이다. 브레드크럼·비디오는 사실 서술이라 유지. */}
      {isIndexableMeme(meme) && (
        <>
          <MemeWebPageJsonLd
            name={meme.title}
            summary={meme.summary}
            description={meme.description}
            shortId={meme.short_id}
            slug={meme.slug}
            datePublished={meme.published_at ?? meme.created_at}
            dateModified={meme.updated_at}
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
      {isYouTubeRep && (
        <MemeVideoJsonLd
          name={meme.title}
          description={meme.summary}
          videoId={representative.content_id!}
          thumbnailUrl={representative.thumbnail_url}
          uploadDate={meme.created_at}
          caption={representative.caption}
        />
      )}
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
          {MODERATION_STATUS.limited.user} — 정보가 바뀔 수 있어요.
        </p>
      )}

      {/* 정답 카드를 2단 그리드 **위**로 올린다.
          모바일에서는 그리드가 세로로 풀리면서 왼쪽 레일(대표 영상 662px)이 통째로
          정보 앞에 왔고, 그 결과 h1이 1399px·정답 카드가 1344px 아래에 있었다 —
          첫 뷰포트(844px)에 이 밈의 뜻과 신호가 하나도 없었다는 뜻이다.
          카드를 그리드 밖으로 빼면 모바일은 "뜻 먼저, 영상 나중"(LOOP.md 정보 계층)이
          되고 데스크톱은 제목이 전체 폭을 쓰는 헤더가 된다. 2단 구조 자체는 그대로다. */}
      <AnswerCard meme={meme} />

      {/* 상세 진입 유도 — 로그인/가입(로그아웃 방문자 전용, 클라이언트 판정으로 SSG·SEO
          불변). 컴포넌트 문서가 명시한 자리가 "정답 카드 직후"다. 이전에는 본문보다
          위에 있어 첫 화면 410px를 가져갔다. */}
      <AuthInvite />

      {/* 감상(좌)·정보(우) 2단 — 데스크톱은 영상을 고정하고 오른쪽 정보만 스크롤,
          모바일은 정답 카드 다음에 영상, 그다음 나머지 정보가 이어진다. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        {/* 왼쪽 레일 — 영상/SNS + 감상 액션(반응·저장). 데스크톱에서 고정. */}
        <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
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
              title={meme.title}
              isRepresentative={representative?.is_representative ?? true}
              category={meme.category}
              originYear={meme.origin_year}
            />
          </section>

          {/* 감상과 함께 머무는 반응·저장 — 영상 옆에 붙어 스크롤을 따라간다 */}
          <ReactionBar memeId={meme.id} initialCounts={reactionCounts} />
          {/* 저장 버튼 폭을 레이아웃(flex-1)으로 고정 — 라벨/알림 문구 변화로
              고유 폭이 바뀌어도 행이 흔들리지 않는다. items-start로 알림 줄바꿈 시
              이웃 버튼이 상하로 밀리는 것도 방지. */}
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <SaveButton memeId={meme.id} />
            </div>
            <ExportButton shortId={meme.short_id} />
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

        {/* 오른쪽 — 정보. 오른쪽만 스크롤된다. */}
        <div className="mt-6 min-w-0 space-y-5 lg:mt-0">
          {/* 정리 중 안내 — content-depth가 '얇음'으로 본 문서에만. 방치된 스텁이 아니라
              확인된 만큼만 공개하는 관리 문서임을 밝히고 제보 경로를 연다.
              충실도 판정은 generateMetadata의 robots와 같은 입력(meme)을 쓴다. */}
          <DocStatusNote meme={meme} title={meme.title} shortId={meme.short_id} />

          {/* 판정 근거 한 블록 — 신호등 의미·usage_note·상황별 가이드·sentiment·caution 통합 */}
          <SafetyRationale
            level={meme.safety_level}
            sentiment={meme.sentiment}
            context={meme.usage_context}
            note={meme.usage_note}
            caution={meme.caution}
          />

          {(meme.description || meme.origin) && (
            <section
              aria-labelledby="meme-about"
              className="glass-panel relative overflow-hidden rounded-2xl p-5"
            >
              {/* 계측 격자 — glass-panel과 같은 노드에 두면 배경 shorthand가 grid-line을
                  지우므로 별도 레이어로 둔다(status-panel.tsx 문법 재사용). 정적이라 성능 비용 없음. */}
              <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
              <div className="relative space-y-4">
                <h2 id="meme-about" className="sr-only">
                  뜻과 유래
                </h2>
                {meme.description && (
                  <div>
                    <h3 className="text-lg font-bold">무슨 뜻이에요?</h3>
                    <p className="mt-1.5 whitespace-pre-line text-base leading-relaxed">
                      {meme.description}
                    </p>
                  </div>
                )}
                {meme.origin && (
                  <div>
                    <h3 className="text-lg font-bold">어디서 시작됐어요?</h3>
                    <p className="mt-1.5 whitespace-pre-line text-base leading-relaxed">
                      {meme.origin}
                    </p>
                  </div>
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
                />
              </div>
            </section>
          )}

          {/* 대화 예문 — 데이터는 에이전트 D 의존(usage_examples 없으면 null 렌더) */}
          <UsageExamples examples={usageExamples} />

          {/* 참고 자료 근거 목록 — 제목 있는 출처가 하나도 없으면 렌더하지 않는다.
              유래 아래 인라인 링크와 달리 무엇을 근거로 삼았는지 펼쳐 보인다. */}
          <SourceEvidence sources={meme.meme_sources} shortId={meme.short_id} />

          {/* Plus 트렌드 추이 — 이 페이지의 SSG를 지키려고 서버에서 구독을 읽지 않는다.
              권한 검사·데이터 제공은 클라이언트가 호출하는 /api/memes/[id]/trend가 담당. */}
          <MemeTrendPanel memeId={meme.id} />

          <Comments memeId={meme.id} />

          {/* 후원 — 본문·반응을 거친 고관여 지점에 절제된 1개 CTA(1인 운영 비영리) */}
          <DonateCard />
        </div>
      </div>

      {/* 더 둘러보기 — 관련 밈(비슷한 밈)을 앞에 두고 같은 카테고리로 끝없이 이어보기.
          큐레이션 캐러셀 + 무한 스트림을 하나의 피드로 통합했다. */}
      <div className="border-t border-border pt-10">
        {/* Wave 1 — 세션 깊이: 관련 밈 프리펜드 + 같은 카테고리 무한 이어보기 */}
        <ContinueStream
          currentId={meme.id}
          category={meme.category}
          related={related}
        />
      </div>
    </main>
  );
}
