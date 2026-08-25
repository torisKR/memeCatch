import { describe, expect, it } from "vitest";
import {
  classifyCandidate,
  cosineSimilarity,
  deterministicTextEmbedding,
  koreanTextSimilarity,
  normalizeKoreanText,
  perceptualHashSimilarity,
  scoreCandidate,
} from "./candidates";

describe("MPE candidate scoring", () => {
  it("normalizes Korean-aware text and combines token with trigram similarity", () => {
    expect(normalizeKoreanText("  ＭＥＭＥ! 밈-문구_테스트 ")).toBe("meme 밈 문구 테스트");
    expect(koreanTextSimilarity("퇴근하고 싶다 밈", "퇴근 하고싶다 밈")).toBeGreaterThan(0.5);
    expect(koreanTextSimilarity("퇴근하고 싶다", "고양이 댄스")).toBeLessThan(0.2);
  });

  it("computes perceptual-hash similarity with Hamming distance", () => {
    expect(perceptualHashSimilarity("ffff", "ffff")).toBe(1);
    expect(perceptualHashSimilarity("0000", "ffff")).toBe(0);
    expect(perceptualHashSimilarity("0000", "0001")).toBe(0.9375);
    expect(perceptualHashSimilarity("bad", "longer")).toBeNull();
  });

  it("creates deterministic text embeddings and compares them with cosine similarity", () => {
    const first = deterministicTextEmbedding("퇴근하고 싶다 밈");
    expect(first).toEqual(deterministicTextEmbedding("퇴근하고 싶다 밈"));
    expect(first).toHaveLength(64);
    expect(cosineSimilarity(first, deterministicTextEmbedding("퇴근하고 싶다"))).toBeGreaterThan(0.5);
    expect(cosineSimilarity(first, deterministicTextEmbedding("고양이 춤"))).toBeLessThan(0.5);
  });

  it.each([
    [0.82, "duplicate"],
    [0.65, "related"],
    [0.45, "derived"],
    [0.449, "separate"],
  ] as const)("classifies %s as %s", (score, relation) => {
    expect(classifyCandidate(score)).toBe(relation);
  });

  it("applies the exact duplicate hard rule", () => {
    expect(scoreCandidate({ exactDuplicate: true, signals: {} })).toEqual({
      score: 1,
      relation: "duplicate",
      availableSignals: [],
      contributions: {},
    });
  });

  it("renormalizes only available authorized signal weights", () => {
    const result = scoreCandidate({
      signals: {
        text: { value: 0.9 },
        visual: { value: 1, authorized: false },
        audio: { value: null },
        metadata: { value: 0.3 },
      },
    });

    expect(result.availableSignals).toEqual(["text", "metadata"]);
    expect(result.score).toBeCloseTo(0.7);
    expect(result.contributions.text).toBeCloseTo(0.6);
    expect(result.contributions.metadata).toBeCloseTo(0.1);
    expect(result.relation).toBe("related");
  });
});
