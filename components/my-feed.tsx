import Link from "next/link";
import { createStaticClient } from "@/lib/supabase/server";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";
import { type MemeCategory } from "@/lib/labels";
import type { MemeListItem } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

/**
 * MY — 관심 카테고리 맞춤 피드 (레인 C).
 * profiles.interests가 있으면 해당 카테고리 급상승 밈을, 없으면(또는 결과가 비면)
 * 최근 등록 밈으로 폴백하고 온보딩 유도 문구를 보여준다.
 * 공개 데이터만 읽으므로 createStaticClient(쿠키 미사용) 사용 — lib/queries.ts와 동일 원칙.
 */

const FEED_SELECT = "*, meme_contents(thumbnail_url, is_representative)";
const PUBLIC_STATUSES = ["approved", "limited"] as const;
const FEED_LIMIT = 6;

async function getInterestFeed(categories: MemeCategory[]): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(FEED_SELECT)
      .in("category", categories)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("trend_score", { ascending: false })
      .limit(FEED_LIMIT);
    if (error || !data) return [];
    return data as MemeListItem[];
  } catch {
    return [];
  }
}

async function getFreshFeed(): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(FEED_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(FEED_LIMIT);
    if (error || !data) return [];
    return data as MemeListItem[];
  } catch {
    return [];
  }
}

export async function MyFeed({
  interests,
  locale = "ko",
}: {
  interests: MemeCategory[];
  locale?: Locale;
}) {
  const copy = PREMIUM_COPY[locale].feed;
  const hasInterests = interests.length > 0;
  let memes = hasInterests ? await getInterestFeed(interests) : [];
  const usedFallback = memes.length === 0;
  if (usedFallback) memes = await getFreshFeed();

  const title = hasInterests && !usedFallback ? copy.personalRadar : copy.fresh;

  return (
    <Reveal as="section" className="mt-8 instrument-grid">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link
          href="/onboarding?next=/my"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-signal-cyan underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan focus-visible:rounded-md"
        >
          {hasInterests ? copy.editInterests : copy.setInterests}
        </Link>
      </div>
      {!hasInterests && (
        <p className="mt-2 text-sm text-muted">
          {copy.fallback}
        </p>
      )}
      {memes.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-muted">{copy.empty}</p>
          <Link
            href="/explore"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.explore}
          </Link>
        </div>
      ) : (
        <MotionList
          as="ul"
          itemAs="li"
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
          itemClassName="min-w-0"
        >
          {memes.map((meme) => (
            <MemeCard key={meme.id} meme={meme} />
          ))}
        </MotionList>
      )}
    </Reveal>
  );
}
