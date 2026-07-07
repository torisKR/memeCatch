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
import { ViewTracker } from "./view-tracker";

/** 밈 상세 — 공개 ISR (10분), 온디맨드 생성 */
export const revalidate = 600;

export async function generateStaticParams(): Promise<{ key: string }[]> {
  return [];
}

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const meme = await getMemeByShortId(shortIdFromParam(key));
  if (!meme) return { title: "밈을 찾을 수 없어요" };
  return { title: meme.title, description: meme.summary };
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
  const fallbackSourceUrl = meme.meme_sources[0]?.source_url ?? null;
  const sentimentChip = SENTIMENT[meme.sentiment].user;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 pb-14">
      <ViewTracker memeId={meme.id} />

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
            </div>
          )}
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
          <ul className="mt-3 grid grid-cols-2 gap-4">
            {related.map((m) => (
              <li key={m.id} className="min-w-0">
                <MemeCard meme={m} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReactionBar memeId={meme.id} initialCounts={reactionCounts} />
    </main>
  );
}
