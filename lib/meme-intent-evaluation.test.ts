import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canSendMemeIntent, MEME_INTENTS } from "./meme-intent";
import { classifyMemeIntent } from "./meme-intent.server";
import {
  evaluateMemeIntentCases,
  MEME_INTENT_EVALUATION_CASES,
  summarizeMemeIntentEvaluation,
} from "./meme-intent-evaluation";

describe("curated Korean offline meme-intent evaluation", () => {
  it("contains exactly 50 unique, synthetic cases across every intent", () => {
    expect(MEME_INTENT_EVALUATION_CASES).toHaveLength(50);
    expect(new Set(MEME_INTENT_EVALUATION_CASES.map((testCase) => testCase.id)).size).toBe(50);
    expect(new Set(MEME_INTENT_EVALUATION_CASES.map((testCase) => testCase.query)).size).toBe(50);
    expect(new Set(MEME_INTENT_EVALUATION_CASES.map((testCase) => testCase.expected))).toEqual(new Set(MEME_INTENTS));
    expect(MEME_INTENT_EVALUATION_CASES.every((testCase) => canSendMemeIntent(testCase.query))).toBe(true);
  });

  it("meets the routing threshold without provider calls", async () => {
    const outcomes = await evaluateMemeIntentCases({ cases: MEME_INTENT_EVALUATION_CASES, classify: classifyMemeIntent });
    const summary = summarizeMemeIntentEvaluation(outcomes);
    expect(summary).toMatchObject({ completed: 50, eligible: 50, approval: "approved" });
    expect(summary.accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("requires the complete fixture before an approval claim", async () => {
    const outcomes = await evaluateMemeIntentCases({ cases: MEME_INTENT_EVALUATION_CASES.slice(0, 49), classify: classifyMemeIntent });
    expect(summarizeMemeIntentEvaluation(outcomes).approval).toBe("incomplete");
  });
});
