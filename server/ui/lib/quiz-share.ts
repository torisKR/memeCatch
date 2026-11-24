/**
 * 밈력고사 결과 공유 토큰 — DB 저장 없이 URL 하나에 결과를 담는다.
 *
 * 형식: `{모드 1자}{정답 비트마스크 3자리 hex}{short_id 8자 × N}`
 *   예) a2f7 + kq3mxp8a + … (10문항이면 84자)
 * - 모드: a(전체) / n(요즘) / r(추억)
 * - 마스크: i번째 비트 = i번째 문항 정답 여부 → 점수·정오 패턴 복원
 * - short_id 목록 = "내 점수 이겨보기"가 다시 출제할 같은 문제 세트
 *
 * 서명이 없어 점수를 조작한 링크도 만들 수 있다. 재미용 퀴즈라 감수하고,
 * 토큰 형식만 엄격히 검증해 임의 문자열이 DB 조회로 이어지지 않게 한다.
 */
import { gradeForScore, QUIZ_SIZE, type QuizGrade, type QuizMode, type QuizQuestion } from "@/server/ui/lib/quiz";

/**
 * gen_short_id()는 혼동 문자(0·1·i·l·o)를 빼지만, 큐레이션 시드 밈은 jkm2022k·oyj2021k
 * 처럼 직접 지정한 id를 쓴다. 카탈로그에 실제로 있는 형태(소문자 영숫자 8자)를 모두 허용.
 */
export const QUIZ_SHORT_ID_PATTERN = /^[a-z0-9]{8}$/;
const SHORT_ID_LENGTH = 8;
const HEADER_LENGTH = 4;

const MODE_TO_CHAR: Record<QuizMode, string> = { all: "a", now: "n", retro: "r" };
const CHAR_TO_MODE: Record<string, QuizMode> = { a: "all", n: "now", r: "retro" };

export type QuizShareResult = {
  token: string;
  mode: QuizMode;
  shortIds: string[];
  /** i번째 문항 정답 여부 */
  correct: boolean[];
  score: number;
  total: number;
  grade: QuizGrade;
};

export function encodeQuizShareToken(input: {
  mode: QuizMode;
  shortIds: string[];
  correct: boolean[];
}): string | null {
  const { mode, shortIds, correct } = input;
  if (shortIds.length === 0 || shortIds.length > QUIZ_SIZE) return null;
  if (!shortIds.every((id) => QUIZ_SHORT_ID_PATTERN.test(id))) return null;
  let mask = 0;
  shortIds.forEach((_, i) => {
    if (correct[i]) mask |= 1 << i;
  });
  return `${MODE_TO_CHAR[mode]}${mask.toString(16).padStart(3, "0")}${shortIds.join("")}`;
}

export function decodeQuizShareToken(raw: string): QuizShareResult | null {
  const token = raw.trim();
  if (token.length < HEADER_LENGTH + SHORT_ID_LENGTH) return null;
  const mode = CHAR_TO_MODE[token[0]!];
  if (!mode) return null;
  const maskHex = token.slice(1, HEADER_LENGTH);
  if (!/^[0-9a-f]{3}$/.test(maskHex)) return null;
  const body = token.slice(HEADER_LENGTH);
  if (body.length % SHORT_ID_LENGTH !== 0) return null;
  const total = body.length / SHORT_ID_LENGTH;
  if (total < 1 || total > QUIZ_SIZE) return null;
  const shortIds: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const id = body.slice(i * SHORT_ID_LENGTH, (i + 1) * SHORT_ID_LENGTH);
    if (!QUIZ_SHORT_ID_PATTERN.test(id)) return null;
    shortIds.push(id);
  }
  if (new Set(shortIds).size !== shortIds.length) return null;
  const mask = parseInt(maskHex, 16);
  if (mask >= 1 << total) return null;
  const correct = shortIds.map((_, i) => (mask & (1 << i)) !== 0);
  const score = correct.filter(Boolean).length;
  return { token, mode, shortIds, correct, score, total, grade: gradeForScore(score, total) };
}

/** 푼 문항과 답안 → 공유 토큰 */
export function quizShareTokenFor(
  mode: QuizMode,
  questions: QuizQuestion[],
  answers: number[]
): string | null {
  return encodeQuizShareToken({
    mode,
    shortIds: questions.map((q) => q.meme.shortId),
    correct: questions.map((q, i) => answers[i] === q.answerIndex),
  });
}

export function quizResultPath(token: string): string {
  return `/quiz/r/${token}`;
}

export const QUIZ_OG_SIZE = { width: 1200, height: 630 } as const;

export function quizResultOgPath(token: string): string {
  return `/og/quiz/${token}`;
}

export const QUIZ_MODE_LABEL: Record<QuizMode, string> = {
  all: "전체",
  now: "요즘 밈",
  retro: "추억 밈",
};
