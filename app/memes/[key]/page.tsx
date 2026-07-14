import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  MODERATION_STATUS,
  SENTIMENT,
  shortIdFromParam,
} from "@/lib/labels";
import {
  getMemeByShortId,
  getReactionCounts,
  getRelatedMemes,
} from "@/lib/queries";
import { AnswerCard } from "@/components/answer-card";
import { UsageGuide } from "@/components/usage-guide";
import { MemeEmbed } from "@/components/meme-embed";
import { MemeCard } from "@/components/meme-card";
import { ReactionBar } from "@/components/reaction-bar";
import { Comments } from "@/components/comments";
import { SaveButton } from "@/components/save-button";
import {
  MemeBreadcrumbJsonLd,
  MemeVideoJsonLd,
  MemeWebPageJsonLd,
} from "@/components/json-ld";
import { memePathFrom } from "@/lib/labels";
import { DonateCard } from "@/components/donate-card";
import { ViewTracker } from "./view-tracker";
import { ContinueStream } from "@/components/continue-stream";
import { TrackedBlock } from "@/components/tracked-block";
import { ContextNav } from "@/components/context-nav";
import { preferredSourceUrl, sourceLinksWithContent } from "@/lib/source-links";

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
  return {
    // "X 뜻" 롱테일 검색 질의와 일치하는 타이틀 패턴 (템플릿이 "| 밈캐치" 부착)
    title: `${meme.title} 뜻`,
    description: `${meme.title} 뜻과 유래 — ${meme.summary}. 지금 써도 되는지 사용 안전 신호등까지 확인하세요.`,
    // canonical — short_id+slug 변형 URL의 신호 분산 방지
    alternates: { canonical: memePathFrom(meme.short_id, meme.slug) },
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
    getRelatedMemes(
      { id: meme.id, category: meme.category, origin_year: meme.origin_year },
      tagIds
    ),
    getReactionCounts(meme.id),
  ]);

  const representative =
    meme.meme_contents.find((c) => c.is_representative) ??
    meme.meme_contents[0] ??
    null;
  const sourceLinks = sourceLinksWithContent(meme.meme_sources, meme.meme_contents);
  const fallbackSourceUrl = preferredSourceUrl(sourceLinks);
  const sentimentChip = SENTIMENT[meme.sentiment].user;

  const isYouTubeRep =
    representative?.platform?.toLowerCase() === "youtube" &&
    !!representative.content_id;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 pb-14">
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

      <AnswerCard meme={meme} />

      {sentimentChip && (
        <p
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
          style={{
            color: "var(--sent-controversial)",
            background:
              "color-mix(in srgb, var(--sent-controversial) 12%, var(--surface))",
          }}
        >
          <span aria-hidden>◆</span>
          {sentimentChip}
        </p>
      )}

      <UsageGuide context={meme.usage_context} note={meme.usage_note} />

      <section aria-label="대표 콘텐츠">
        <MemeEmbed
          content={representative}
          fallbackSourceUrl={fallbackSourceUrl}
          title={meme.title}
        />
      </section>

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
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
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
              {/* 상시 출처 인용 — E-E-A-T: 유래 주장 바로 아래에 근거 링크 */}
              {sourceLinks.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
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
            </div>
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

      {meme.caution && (
        <section
          aria-labelledby="meme-caution"
          className="rounded-2xl bg-safety-yellow-bg p-5 text-safety-yellow"
        >
          <h2
            id="meme-caution"
            className="flex items-center gap-2 text-lg font-bold"
          >
            <span aria-hidden>▲</span> 이건 조심해 주세요
          </h2>
          <p className="mt-1.5 whitespace-pre-line text-base leading-relaxed">
            {meme.caution}
          </p>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-memes">
          <h2 id="related-memes" className="text-xl font-bold">
            이 밈도 알아두면 좋아요
          </h2>
          <TrackedBlock event="related_click">
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {related.map((m) => (
                <li key={m.id} className="min-w-0">
                  <MemeCard meme={m} />
                </li>
              ))}
            </ul>
          </TrackedBlock>
        </section>
      )}

      <SaveButton memeId={meme.id} />

      <ReactionBar memeId={meme.id} initialCounts={reactionCounts} />

      {/* 후원 — 본문·반응을 거친 고관여 지점에 절제된 1개 CTA(1인 운영 비영리) */}
      <DonateCard />

      <Comments memeId={meme.id} />

      {/* Wave 1 — 세션 깊이: 같은 카테고리 무한 이어보기 */}
      <ContinueStream
        currentId={meme.id}
        category={meme.category}
        relatedIds={related.map((m) => m.id)}
      />
    </main>
  );
}
