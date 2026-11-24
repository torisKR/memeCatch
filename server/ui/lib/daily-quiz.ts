/**
 * 오늘의 밈 퀴즈(무료, 하루 1문제) 공용 순수 로직.
 * - KST 날짜 키·해시(오늘의 밈 위젯과 같은 기준)로 하루 동안 같은 문제를 고정한다.
 * - 비로그인 사용자의 연속 출석은 이 모듈의 로컬 기록 계산으로 유지한다.
 *   로그인 사용자의 연속 출석은 DB RPC(get/complete_daily_meme_quiz)가 정본이다.
 */

export type DailyQuizStatus = {
  quizDate: string;
  answeredToday: boolean;
  correctToday: boolean | null;
  currentStreak: number;
  bestStreak: number;
  totalDays: number;
};

/** KST 기준 YYYY-MM-DD */
export function kstDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** mulberry32 — 날짜 시드로 같은 날엔 항상 같은 셔플·보기 순서를 만든다 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHORT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 날짜별 결정적 short_id 피벗 — 밈 수가 늘어도 같은 날 출제 풀이 거의 흔들리지 않는다 */
export function dailyPivot(dayKey: string): string {
  const rng = seededRng(hashCode(`daily-quiz:${dayKey}`));
  return Array.from(
    { length: 8 },
    () => SHORT_ID_ALPHABET[Math.floor(rng() * SHORT_ID_ALPHABET.length)],
  ).join("");
}

/** YYYY-MM-DD의 전날 (UTC 산술 — 날짜 키 자체가 이미 KST라 시간대 변환 없음) */
export function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// ── 비로그인 로컬 기록 ─────────────────────────────────────────

export const LOCAL_STREAK_KEY = "mc_daily_quiz_v1";

export type LocalDailyQuizRecord = {
  lastDate: string;
  streak: number;
  best: number;
  total: number;
  lastSelected: number;
  lastCorrect: boolean;
};

export function parseLocalRecord(raw: string | null): LocalDailyQuizRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LocalDailyQuizRecord>;
    if (
      typeof v.lastDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v.lastDate) ||
      typeof v.streak !== "number" ||
      typeof v.best !== "number" ||
      typeof v.total !== "number" ||
      typeof v.lastSelected !== "number" ||
      typeof v.lastCorrect !== "boolean"
    ) {
      return null;
    }
    return v as LocalDailyQuizRecord;
  } catch {
    return null;
  }
}

/** 오늘 기준 로컬 기록을 화면 상태로 — 어제까지 이어졌으면 연속 유지, 하루 이상 빠졌으면 0 */
export function statusFromLocal(
  record: LocalDailyQuizRecord | null,
  today: string,
): DailyQuizStatus {
  if (!record) {
    return { quizDate: today, answeredToday: false, correctToday: null, currentStreak: 0, bestStreak: 0, totalDays: 0 };
  }
  const answeredToday = record.lastDate === today;
  const alive = answeredToday || record.lastDate === previousDayKey(today);
  return {
    quizDate: today,
    answeredToday,
    correctToday: answeredToday ? record.lastCorrect : null,
    currentStreak: alive ? record.streak : 0,
    bestStreak: record.best,
    totalDays: record.total,
  };
}

/** 오늘 답을 로컬 기록에 반영. 같은 날 두 번째 답은 무시(첫 답만 인정) */
export function recordLocalAnswer(
  record: LocalDailyQuizRecord | null,
  today: string,
  selected: number,
  correct: boolean,
): LocalDailyQuizRecord {
  if (record?.lastDate === today) return record;
  const continues = record?.lastDate === previousDayKey(today);
  const streak = continues ? record!.streak + 1 : 1;
  return {
    lastDate: today,
    streak,
    best: Math.max(record?.best ?? 0, streak),
    total: (record?.total ?? 0) + 1,
    lastSelected: selected,
    lastCorrect: correct,
  };
}

/** DB RPC 행(snake_case) → 화면 상태 */
export function statusFromRpcRow(row: {
  quiz_date: string;
  completed_at: string | null;
  correct: boolean | null;
  current_streak: number;
  best_streak: number;
  total_days: number;
}): DailyQuizStatus {
  return {
    quizDate: row.quiz_date,
    answeredToday: row.completed_at !== null,
    correctToday: row.completed_at !== null ? row.correct : null,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    totalDays: row.total_days,
  };
}
