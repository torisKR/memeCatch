import {
  PLUS_OUTCOME_CHANNELS,
  isPlusOutcomeChannel,
  type PlusOutcomeChannel,
  type PlusOutcomeRatingRow,
} from "@/lib/plus-outcome-ledger";

export const PLUS_OUTCOME_CHANNEL_MIN_TOTAL_RATINGS = 3;
export const PLUS_OUTCOME_CHANNEL_MIN_SAMPLE = 2;

export type PlusOutcomeChannelRecommendation = {
  channel: PlusOutcomeChannel;
  sampleCount: number;
  score: number;
};

type ChannelStats = PlusOutcomeChannelRecommendation & {
  hitCount: number;
  latestCompletionDate: string;
};

function ratingScore(rating: PlusOutcomeRatingRow["rating"]): number {
  if (rating === "hit") return 1;
  if (rating === "miss") return -1;
  return 0;
}

function channelOrder(channel: PlusOutcomeChannel): number {
  return PLUS_OUTCOME_CHANNELS.indexOf(channel);
}

export function buildPlusOutcomeChannelRecommendation(
  ratings: readonly PlusOutcomeRatingRow[],
): PlusOutcomeChannelRecommendation | null {
  const validRatings = ratings.filter((row) => isPlusOutcomeChannel(row.channel));
  if (validRatings.length < PLUS_OUTCOME_CHANNEL_MIN_TOTAL_RATINGS) return null;

  const stats = new Map<PlusOutcomeChannel, ChannelStats>();
  for (const row of validRatings) {
    const current = stats.get(row.channel) ?? {
      channel: row.channel,
      sampleCount: 0,
      score: 0,
      hitCount: 0,
      latestCompletionDate: row.completionDate,
    };
    current.sampleCount += 1;
    current.score += ratingScore(row.rating);
    current.hitCount += row.rating === "hit" ? 1 : 0;
    if (row.completionDate > current.latestCompletionDate) {
      current.latestCompletionDate = row.completionDate;
    }
    stats.set(row.channel, current);
  }

  const candidates = [...stats.values()].filter(
    (candidate) => candidate.sampleCount >= PLUS_OUTCOME_CHANNEL_MIN_SAMPLE,
  );
  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    const scoreDifference = right.score - left.score;
    if (scoreDifference !== 0) return scoreDifference;

    const leftHitRate = left.hitCount / left.sampleCount;
    const rightHitRate = right.hitCount / right.sampleCount;
    const hitRateDifference = rightHitRate - leftHitRate;
    if (hitRateDifference !== 0) return hitRateDifference;

    const sampleDifference = right.sampleCount - left.sampleCount;
    if (sampleDifference !== 0) return sampleDifference;

    const latestDifference = right.latestCompletionDate.localeCompare(left.latestCompletionDate);
    if (latestDifference !== 0) return latestDifference;

    return channelOrder(left.channel) - channelOrder(right.channel);
  });

  const winner = candidates[0];
  if (!winner || winner.score <= 0) return null;

  return {
    channel: winner.channel,
    sampleCount: winner.sampleCount,
    score: winner.score,
  };
}
