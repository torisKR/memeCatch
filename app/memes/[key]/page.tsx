import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  MODERATION_STATUS,
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
import { ReactionBar } from "@/components/reaction-bar";
import { Comments } from "@/components/comments";
import { SaveButton } from "@/components/save-button";
import { ExportButton } from "@/components/export-button";
import {
  MemeBreadcrumbJsonLd,
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
import { DocStatusNote } from "@/components/doc-status-note";
import { isIndexableMeme } from "@/lib/content-depth";

/** 밈 상세 문서는 요청별 SSR. React cache는 같은 요청 안의 중복 상세 조회만 제거한다. */
export const revalidate = 600;

export async function generateStaticParams(): Promise<{ key: string }[]> {
  return [];
}

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const meme = await getMemeByShortId(shortIdFromParam(key));
  if (!meme) return { title: "밈을 찾을 수 없어요" };
  const path = memePathFrom(meme.short_id, meme.slug);
  const description = `${meme.title} 뜻과 유래 — ${meme.summary}. 지금 써도 되는지 사용 안전 신호등까지 확인하세요.`;
  return {
    // "X 뜻" 롱테일 검색 질의와 일치하는 타이틀 패턴 (템플릿이 "| 밈캐치" 부착)
    title: `${meme.title} 뜻`,
    description,
    // canonical — short_id+slug 변형 URL의 신호 분산 방지
    alternates: { canonical: path },
    // 콘텐츠가 얇은 문서는 색인에서 뺀다(사이트맵에서도 빠짐 — lib/content-depth.ts).
    // follow는 유지 — 페이지는 200으로 살아 있고, 관련 밈·출처 링크로 크롤이 전파돼야 한다.
    ...(isIndexableMeme(meme) ? {} : { robots: { index: false, follow: true } }),
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 밈별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
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

  const liveContents = meme.meme_contents.filter(
    (c) => c.availability !== "dead" && c.moderation_status === "approved",
  );
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

  const isYouTubeRep =
    representative?.platform?.toLowerCase() === "youtube" &&
    !!representative.content_id;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-14">
      {/* GEO: WebPage(날짜·speakable) + mainEntity DefinedTerm + 브레드크럼 + 대표영상 */}
      <MemeWebPageJsonLd
        name={meme.title}
        summary={meme.summary}
        description={meme.description}
        shortId={meme.short_id}
        slug={meme.slug}
        datePublished={meme.published_at ?? meme.created_at}
        dateModified={meme.updated_at}
      />
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

      {/* 상세 진입 유도 — 로그인/가입(로그아웃 방문자 전용, 클라이언트 판정으로 SSG·SEO 불변) */}
      <AuthInvite />

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

      {/* 감상(좌)·정보(우) 2단 — 데스크톱은 영상을 고정하고 오른쪽 정보만 스크롤,
          모바일은 영상을 맨 위에 두고 세로로 이어진다. SSG·SEO 구조는 그대로. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        {/* 왼쪽 레일 — 영상/SNS + 감상 액션(반응·저장). 데스크톱에서 고정. */}
        <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
          <section
            aria-label={representative?.is_representative ? "대표 콘텐츠" : "관련 콘텐츠"}
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
          <AnswerCard meme={meme} />

          {/* 정리 중 안내 — content-depth가 '얇음'으로 본 문서에만. 방치된 스텁이 아니라
              확인된 만큼만 공개하는 관리 문서임을 밝히고 제보 경로를 연다.
              충실도 판정은 generateMetadata의 robots와 같은 입력(meme)을 쓴다. */}
          <DocStatusNote meme={meme} title={meme.title} />

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
              className="space-y-4 rounded-2xl border border-border bg-surface p-5"
            >
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
                {meme.origin_year && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium">
                    {meme.origin_year}년생 밈
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

              {/* 상시 출처 인용 — E-E-A-T: 본문 주장 바로 아래에 근거 링크 */}
              {sourceLinks.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <span className="font-semibold">출처:</span>
                  {sourceLinks.slice(0, 3).map((s, i) => (
                    <a
                      key={s.source_url ?? i}
                      href={s.source_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-6 items-center gap-0.5 underline underline-offset-2 transition-colors hover:text-foreground"
                    >
                      {s.source_url?.includes("namu.wiki")
                        ? "나무위키"
                        : s.platform || "원문"}
                      <span aria-hidden className="text-xs">↗</span>
                    </a>
                  ))}
                </p>
              )}
              {/* 신선도 신호 — 검수·갱신 시점을 독자에게 노출 (E-E-A-T) */}
              <p className="border-t border-border pt-3 text-sm text-muted">
                밈캐치 검수팀 확인 · 마지막 업데이트{" "}
                <time dateTime={meme.updated_at}>
                  {new Date(meme.updated_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </p>
            </section>
          )}

          {/* 대화 예문 — 데이터는 에이전트 D 의존(usage_examples 없으면 null 렌더) */}
          <UsageExamples examples={usageExamples} />

          {/* 참고 자료 근거 목록 — 제목 있는 출처가 하나도 없으면 렌더하지 않는다.
              유래 아래 인라인 링크와 달리 무엇을 근거로 삼았는지 펼쳐 보인다. */}
          <SourceEvidence sources={meme.meme_sources} />

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
