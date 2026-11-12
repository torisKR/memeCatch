export type PublicRankingMeme = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string | null;
  safety_level: string;
  lifecycle_status: string;
  trend_score: number | null;
  published_at: string | null;
};

export type LiveKoreanRankings = {
  kind: "live";
  fallback: PublicRankingMeme[] | null;
  today: PublicRankingMeme[];
  weekly: (PublicRankingMeme & { weeklyViews: number })[];
  weeklyLocked: true;
  comeback: PublicRankingMeme[];
  lastRollupDate: null;
  topWeeklyViews: 0;
};

export type KoreanRankings =
  | LiveKoreanRankings
  | { kind: "published"; memes: PublicRankingMeme[] }
  | { kind: "unavailable" }
  | { kind: "outage" };

export function liveRankingHasRows(
  live: Pick<LiveKoreanRankings, "fallback" | "today" | "comeback"> | null,
): boolean {
  if (!live) return false;
  return (live.fallback?.length ?? 0) > 0 || live.today.length > 0 || live.comeback.length > 0;
}

/**
 * Live trend rows win. A failed or empty live read falls back to published
 * memes. Neither source yields a 200 error page.
 */
export function resolveKoreanRankings(input: {
  liveError: boolean;
  live: Omit<LiveKoreanRankings, "kind" | "weekly" | "weeklyLocked" | "lastRollupDate" | "topWeeklyViews"> | null;
  published: PublicRankingMeme[] | null;
}): KoreanRankings {
  if (!input.liveError && liveRankingHasRows(input.live) && input.live) {
    return {
      kind: "live",
      fallback: input.live.fallback,
      today: input.live.today,
      weekly: [],
      weeklyLocked: true,
      comeback: input.live.comeback,
      lastRollupDate: null,
      topWeeklyViews: 0,
    };
  }
  if (input.published && input.published.length > 0) {
    return { kind: "published", memes: input.published };
  }
  if (input.liveError && input.published === null) return { kind: "outage" };
  return { kind: "unavailable" };
}
