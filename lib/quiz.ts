/**
 * 밈력고사 문항 생성·채점 순수 로직 (/quiz, /api/quiz 공용).
 * DB 접근 없음 — API 라우트가 넘긴 밈 풀에서 문항을 조립하고,
 * 클라이언트가 점수 → 등급/밈 감성 연대를 계산할 때 재사용한다.
 */

export type QuizMode = "all" | "now" | "retro";

export const QUIZ_SIZE = 10;
export const OPTION_COUNT = 4;
/** 요약이 이보다 짧으면 보기로 쓰기에 정보가 부족 — 문항·오답 후보에서 제외 */
export const MIN_SUMMARY_LENGTH = 20;

/** DB에서 받아온 문항 후보 밈 (memes 테이블 부분 선택) */
export type QuizPoolMeme = {
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  origin_year: number | null;
  safety_level: string;
};

export type QuizQuestion = {
  /** "「{title}」, 무슨 뜻일까요?" */
  question: string;
  /** 보기 4개 (셔플 완료) */
  options: string[];
  /** options 내 정답 위치 — 단순 재미 퀴즈라 클라이언트 채점 */
  answerIndex: number;
  /** 해설("이 밈 보러가기") 링크·연대 판정용 메타 */
  meme: {
    shortId: string;
    slug: string;
    title: string;
    originYear: number | null;
    safetyLevel: string;
  };
};

type Rng = () => number;

function normalizeSummary(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Fisher–Yates — rng 주입 가능(테스트 결정성) */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 오답 보기 3개 선택 — 같은 카테고리 우선, 정답과 길이가 비슷한 요약 우선.
 * 길이 근접 상위 후보 중에서 무작위로 뽑아 매번 다른 보기가 나오게 한다.
 * 같은 카테고리에서 3개를 못 채우면 다른 카테고리로 폴백.
 */
function pickDistractors(
  answerSummary: string,
  sameCategory: QuizPoolMeme[],
  others: QuizPoolMeme[],
  rng: Rng
): string[] {
  const picked: string[] = [];
  const NEAR_WINDOW = 9;

  for (const source of [sameCategory, others]) {
    if (picked.length >= OPTION_COUNT - 1) break;

    const candidates = [
      ...new Set(source.map((m) => normalizeSummary(m.summary))),
    ]
      .filter((s) => s !== answerSummary && !picked.includes(s))
      .sort(
        (a, b) =>
          Math.abs(a.length - answerSummary.length) -
          Math.abs(b.length - answerSummary.length)
      );

    for (const s of shuffle(candidates.slice(0, NEAR_WINDOW), rng)) {
      if (picked.length >= OPTION_COUNT - 1) break;
      picked.push(s);
    }
    for (const s of candidates.slice(NEAR_WINDOW)) {
      if (picked.length >= OPTION_COUNT - 1) break;
      picked.push(s);
    }
  }

  return picked;
}

/**
 * 밈 풀에서 최대 count개 문항 생성.
 * - 요약 20자 미만·중복 요약 제외, 문항당 보기 4개(정답 1 + 오답 3) 셔플
 * - 오답을 3개 못 채운 밈은 건너뜀 (풀이 충분하면 발생하지 않음)
 */
export function buildQuestions(
  pool: QuizPoolMeme[],
  count: number = QUIZ_SIZE,
  rng: Rng = Math.random
): QuizQuestion[] {
  const eligible = pool.filter(
    (m) =>
      m.short_id &&
      m.slug &&
      m.title &&
      normalizeSummary(m.summary).length >= MIN_SUMMARY_LENGTH
  );

  const questions: QuizQuestion[] = [];
  for (const answer of shuffle(eligible, rng)) {
    if (questions.length >= count) break;

    const answerSummary = normalizeSummary(answer.summary);
    const sameCategory: QuizPoolMeme[] = [];
    const others: QuizPoolMeme[] = [];
    for (const candidate of eligible) {
      if (candidate.short_id === answer.short_id) continue;
      if (normalizeSummary(candidate.summary) === answerSummary) continue;
      (candidate.category === answer.category ? sameCategory : others).push(
        candidate
      );
    }

    const distractors = pickDistractors(answerSummary, sameCategory, others, rng);
    if (distractors.length < OPTION_COUNT - 1) continue;

    const options = shuffle([answerSummary, ...distractors], rng);
    questions.push({
      question: `「${answer.title}」, 무슨 뜻일까요?`,
      options,
      answerIndex: options.indexOf(answerSummary),
      meme: {
        shortId: answer.short_id,
        slug: answer.slug,
        title: answer.title,
        originYear: answer.origin_year,
        safetyLevel: answer.safety_level,
      },
    });
  }

  return questions;
}

/** 등급 5단계 — 위트 있되 비하 없음 (기획 확정 문구) */
export type QuizGrade = { label: string; comment: string };

export function gradeForScore(correct: number, total: number): QuizGrade {
  const pct = total > 0 ? (correct / total) * 100 : 0;
  if (pct >= 90)
    return {
      label: "밈장인",
      comment: "지금 이 순간 뜨는 밈도 이미 알고 계시죠? 존경합니다.",
    };
  if (pct >= 70)
    return {
      label: "밈잘알",
      comment: "대화방 밈 해설 담당은 당신이었군요.",
    };
  if (pct >= 50)
    return {
      label: "밈러",
      comment: "감은 확실히 있어요. 급상승 탭이 마지막 퍼즐이에요.",
    };
  if (pct >= 30)
    return {
      label: "밈뉴비",
      comment: "출발이 좋아요. 오늘의 밈부터 하나씩 캐치!",
    };
  return {
    label: "밈세계 입문 환영",
    comment: "지금부터 알아가면 딱 좋은 타이밍이에요.",
  };
}

/**
 * 맞힌 문항들의 origin_year 평균 → "2010년대" 같은 연대 라벨.
 * 연도 정보가 하나도 없으면 null (결과 화면에서 문구 생략).
 */
export function eraDecadeLabel(years: number[]): string | null {
  const valid = years.filter((y) => Number.isFinite(y) && y > 1900);
  if (valid.length === 0) return null;
  const avg = valid.reduce((sum, y) => sum + y, 0) / valid.length;
  return `${Math.floor(avg / 10) * 10}년대`;
}
