import { describe, expect, it } from "vitest";
import {
  buildQuestions,
  eraDecadeLabel,
  gradeForScore,
  maskTitleWords,
  MIN_SUMMARY_LENGTH,
  OPTION_COUNT,
  type QuizPoolMeme,
} from "@/lib/quiz";

/** 결정적 rng — 항상 0을 돌려 셔플이 순서를 보존하게 한다 */
const fixedRng = () => 0;

function meme(overrides: Partial<QuizPoolMeme> & { short_id: string }): QuizPoolMeme {
  return {
    slug: `밈-${overrides.short_id}`,
    title: `밈 ${overrides.short_id}`,
    summary: `충분히 길고 서로 다른 요약 설명 문장입니다 (${overrides.short_id})`,
    category: "phrase",
    origin_year: 2021,
    safety_level: "green",
    ...overrides,
  };
}

describe("gradeForScore — 등급 산정 경계값", () => {
  it.each([
    [10, "밈장인"],
    [9, "밈장인"],
    [8, "밈잘알"],
    [7, "밈잘알"],
    [6, "밈러"],
    [5, "밈러"],
    [4, "밈뉴비"],
    [3, "밈뉴비"],
    [2, "밈세계 입문 환영"],
    [0, "밈세계 입문 환영"],
  ])("10문항 중 %i개 → %s", (correct, label) => {
    expect(gradeForScore(correct, 10).label).toBe(label);
  });

  it("total 0이어도 예외 없이 최하 등급", () => {
    expect(gradeForScore(0, 0).label).toBe("밈세계 입문 환영");
  });
});

describe("buildQuestions — 오답 생성 로직", () => {
  const pool: QuizPoolMeme[] = [
    ...Array.from({ length: 6 }, (_, i) => meme({ short_id: `p${i}`, category: "phrase" })),
    ...Array.from({ length: 6 }, (_, i) => meme({ short_id: `d${i}`, category: "dance" })),
  ];

  it("문항 수·보기 4개·정답 인덱스 정합", () => {
    const questions = buildQuestions(pool, 10, fixedRng);
    expect(questions.length).toBe(10);
    for (const q of questions) {
      expect(q.options).toHaveLength(OPTION_COUNT);
      expect(new Set(q.options).size).toBe(OPTION_COUNT); // 보기 중복 없음
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(OPTION_COUNT);
      expect(q.question).toContain("무슨 뜻일까요?");
      expect(q.meme.shortId).toBeTruthy();
      expect(q.meme.slug).toBeTruthy();
    }
  });

  it("같은 카테고리에 후보가 충분하면 오답은 전부 같은 카테고리에서", () => {
    const questions = buildQuestions(pool, 10, fixedRng);
    const summaryToCategory = new Map(
      pool.map((m) => [m.summary.trim().replace(/\s+/g, " "), m.category])
    );
    for (const q of questions) {
      const answerMeme = pool.find((m) => m.short_id === q.meme.shortId)!;
      for (const [i, option] of q.options.entries()) {
        if (i === q.answerIndex) continue;
        expect(summaryToCategory.get(option)).toBe(answerMeme.category);
      }
    }
  });

  it("같은 카테고리 후보 부족 시 다른 카테고리로 폴백", () => {
    const smallPool: QuizPoolMeme[] = [
      meme({ short_id: "solo", category: "song" }),
      ...Array.from({ length: 5 }, (_, i) => meme({ short_id: `f${i}`, category: "image" })),
    ];
    const questions = buildQuestions(smallPool, 6, fixedRng);
    const solo = questions.find((q) => q.meme.shortId === "solo");
    expect(solo).toBeDefined();
    expect(solo!.options).toHaveLength(OPTION_COUNT);
  });

  it("짧은 요약(20자 미만)은 문항·보기에서 제외", () => {
    const short = meme({ short_id: "short", summary: "너무 짧은 요약" });
    expect(short.summary.length).toBeLessThan(MIN_SUMMARY_LENGTH);
    const questions = buildQuestions([...pool, short], 20, fixedRng);
    expect(questions.some((q) => q.meme.shortId === "short")).toBe(false);
    expect(questions.some((q) => q.options.includes("너무 짧은 요약"))).toBe(false);
  });

  it("정답 밈은 문항 간 중복되지 않음", () => {
    const questions = buildQuestions(pool, 12, fixedRng);
    const ids = questions.map((q) => q.meme.shortId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("maskTitleWords — 제목 단어 노출 차단", () => {
  it("정답 요약에서 곡명·그룹명을 ○○로 가린다", () => {
    const summary =
      "보이넥스트도어 데뷔 수록곡 'One and Only' 선배 스타 참여 챌린지";
    const masked = maskTitleWords(summary, [
      "보이넥스트도어",
      "원앤온리",
      "One and Only",
    ]);
    expect(masked.toLowerCase()).not.toContain("보이넥스트도어");
    expect(masked.toLowerCase()).not.toContain("one and only");
    expect(masked).toContain("○○");
  });

  it("장르어(챌린지 등)는 가리지 않는다", () => {
    expect(maskTitleWords("귀여운 댄스 챌린지", [])).toBe("귀여운 댄스 챌린지");
  });
});

describe("buildQuestions — 제목이 정답을 노출하지 않음", () => {
  it("정답 보기에 제목의 고유 단어가 남지 않는다", () => {
    const pool: QuizPoolMeme[] = [
      meme({
        short_id: "a",
        title: "보이넥스트도어 원앤온리(One and Only) 챌린지",
        summary: "보이넥스트도어 데뷔 수록곡 One and Only 선배 참여 챌린지입니다",
      }),
      meme({ short_id: "b", summary: "완전히 다른 밈에 대한 충분히 긴 설명 문장 하나" }),
      meme({ short_id: "c", summary: "또 다른 밈에 대한 충분히 긴 설명 문장 두울" }),
      meme({ short_id: "d", summary: "세 번째 밈에 대한 충분히 긴 설명 문장 세엣" }),
    ];
    const q = buildQuestions(pool, 4, () => 0).find((x) =>
      x.question.includes("원앤온리")
    );
    expect(q).toBeDefined();
    const answer = q!.options[q!.answerIndex].toLowerCase();
    expect(answer).not.toContain("보이넥스트도어");
    expect(answer).not.toContain("one and only");
  });
});

describe("eraDecadeLabel — 밈 감성 연대 판정", () => {
  it("평균 연도의 연대를 돌려준다", () => {
    expect(eraDecadeLabel([2020, 2022, 2024])).toBe("2020년대");
    expect(eraDecadeLabel([2008, 2012])).toBe("2010년대");
    expect(eraDecadeLabel([1999])).toBe("1990년대");
  });

  it("연도 정보가 없으면 null", () => {
    expect(eraDecadeLabel([])).toBeNull();
  });
});
