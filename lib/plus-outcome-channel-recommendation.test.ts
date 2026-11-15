import { describe, expect, it } from "vitest";
import {
  buildPlusOutcomeChannelRecommendation,
  PLUS_OUTCOME_CHANNEL_MIN_SAMPLE,
  PLUS_OUTCOME_CHANNEL_MIN_TOTAL_RATINGS,
} from "@/lib/plus-outcome-channel-recommendation";
import type { PlusOutcomeChannel, PlusOutcomeRating } from "@/lib/plus-outcome-ledger";

function rating(
  channel: PlusOutcomeChannel,
  value: PlusOutcomeRating,
  date: string,
  memeId = `${channel}-${date}-${value}`,
) {
  return { channel, completionDate: date, memeId, rating: value };
}

describe("Plus outcome channel recommendation", () => {
  it("requires enough total and per-channel evidence", () => {
    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "hit", "2026-08-08"),
      ]),
    ).toBeNull();

    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("tiktok", "hit", "2026-08-08"),
        rating("youtube", "neutral", "2026-08-07"),
      ]),
    ).toBeNull();

    expect(PLUS_OUTCOME_CHANNEL_MIN_TOTAL_RATINGS).toBe(3);
    expect(PLUS_OUTCOME_CHANNEL_MIN_SAMPLE).toBe(2);
  });

  it("selects the highest positive channel and exposes only safe aggregate facts", () => {
    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("threads", "hit", "2026-08-08"),
        rating("threads", "hit", "2026-08-07"),
        rating("threads", "neutral", "2026-08-06"),
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "miss", "2026-08-05"),
      ]),
    ).toEqual({ channel: "threads", sampleCount: 3, score: 2 });
  });

  it("uses hit rate, sample size, recency, then stable channel order for ties", () => {
    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "neutral", "2026-08-08"),
        rating("tiktok", "hit", "2026-08-07"),
        rating("tiktok", "hit", "2026-08-06"),
        rating("tiktok", "miss", "2026-08-05"),
      ]),
    ).toMatchObject({ channel: "tiktok", sampleCount: 3, score: 1 });

    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "neutral", "2026-08-08"),
        rating("tiktok", "hit", "2026-08-07"),
        rating("tiktok", "hit", "2026-08-06"),
        rating("tiktok", "miss", "2026-08-05"),
        rating("tiktok", "neutral", "2026-08-04"),
      ]),
    ).toMatchObject({ channel: "tiktok", sampleCount: 4, score: 1 });

    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "neutral", "2026-08-08"),
        rating("tiktok", "hit", "2026-08-07"),
        rating("tiktok", "neutral", "2026-08-06"),
      ]),
    ).toMatchObject({ channel: "instagram" });

    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "neutral", "2026-08-08"),
        rating("tiktok", "hit", "2026-08-08"),
        rating("tiktok", "neutral", "2026-08-07"),
      ]),
    ).toMatchObject({ channel: "instagram" });

    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "hit", "2026-08-09"),
        rating("instagram", "neutral", "2026-08-09"),
        rating("tiktok", "hit", "2026-08-09"),
        rating("tiktok", "neutral", "2026-08-09"),
      ]),
    ).toMatchObject({ channel: "instagram" });
  });

  it("fails closed when all evidence is neutral or negative", () => {
    expect(
      buildPlusOutcomeChannelRecommendation([
        rating("instagram", "neutral", "2026-08-09"),
        rating("instagram", "miss", "2026-08-08"),
        rating("tiktok", "neutral", "2026-08-07"),
      ]),
    ).toBeNull();
  });
});
