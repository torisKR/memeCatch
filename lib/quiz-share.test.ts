import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "@/lib/quiz";
import {
  decodeQuizShareToken,
  encodeQuizShareToken,
  quizResultPath,
  quizShareTokenFor,
} from "@/lib/quiz-share";

const IDS = ["abcdefgh", "jkmnpqrs", "tuvwxyz2", "3456789a", "bcdefghj", "kmnpqrst", "uvwxyz23", "456789ab", "cdefghjk", "mnpqrstu"];

describe("quiz share token", () => {
  it("round-trips mode, set order and per-question correctness", () => {
    const correct = IDS.map((_, i) => i % 3 !== 0);
    const token = encodeQuizShareToken({ mode: "now", shortIds: IDS, correct });
    expect(token).toMatch(/^n[0-9a-f]{3}/);
    expect(token).toHaveLength(4 + 8 * 10);
    const decoded = decodeQuizShareToken(token!);
    expect(decoded).toMatchObject({ mode: "now", shortIds: IDS, correct, score: 6, total: 10 });
    expect(decoded?.grade.label).toBe("밈러");
  });

  it("encodes a perfect score as the top grade", () => {
    const token = encodeQuizShareToken({ mode: "all", shortIds: IDS, correct: IDS.map(() => true) })!;
    expect(token.slice(0, 4)).toBe("a3ff");
    expect(decodeQuizShareToken(token)?.grade.label).toBe("밈장인");
  });

  it.each([
    ["", "empty"],
    ["x000abcdefgh", "unknown mode"],
    ["a00gabcdefgh", "non-hex mask"],
    ["a002abcdefgh", "mask bit beyond question count"],
    ["a000abcdefg", "partial id"],
    ["a000abcdefgI", "id outside alphabet"],
    ["a000abcdefghabcdefgh", "duplicate ids"],
    [`a000${IDS.join("")}abcdefgh`, "more than 10 questions"],
    ["a000../../etc", "path-like input"],
  ])("rejects %s (%s)", (token) => {
    expect(decodeQuizShareToken(token)).toBeNull();
  });

  it("accepts curated seed ids outside the random-id alphabet", () => {
    const curated = ["jkm2022k", "oyj2021k", "okk2020k"];
    const token = encodeQuizShareToken({ mode: "all", shortIds: curated, correct: [true, true, false] });
    expect(token).not.toBeNull();
    expect(decodeQuizShareToken(token!)).toMatchObject({ shortIds: curated, score: 2, total: 3 });
  });

  it("refuses to encode ids that could not be decoded", () => {
    expect(encodeQuizShareToken({ mode: "all", shortIds: ["p0"], correct: [true] })).toBeNull();
    expect(encodeQuizShareToken({ mode: "all", shortIds: [], correct: [] })).toBeNull();
  });

  it("builds the token from answered questions", () => {
    const questions = IDS.slice(0, 2).map(
      (shortId) => ({ answerIndex: 1, meme: { shortId } }) as unknown as QuizQuestion
    );
    const token = quizShareTokenFor("retro", questions, [1, 0])!;
    expect(quizResultPath(token)).toBe(`/quiz/r/r001${IDS[0]}${IDS[1]}`);
  });
});
