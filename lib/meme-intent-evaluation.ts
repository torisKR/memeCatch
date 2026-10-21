import { canSendMemeIntent, type MemeIntent, type MemeIntentDecision, type MemeIntentReason } from "@/lib/meme-intent";

export const MEME_INTENT_EVAL_REQUIRED_CASES = 50;

export type MemeIntentEvaluationCase = Readonly<{
  id: string;
  query: string;
  expected: MemeIntent;
}>;

/** Synthetic Korean prompts only. Do not replace these labels with model-generated labels. */
export const MEME_INTENT_EVALUATION_CASES = [
  { id: "lookup-01", query: "새삥", expected: "lookup" },
  { id: "lookup-02", query: "ㅅㅃ", expected: "lookup" },
  { id: "lookup-03", query: "중꺾마", expected: "lookup" },
  { id: "lookup-04", query: "킹받네", expected: "lookup" },
  { id: "lookup-05", query: "도마도마 챌린지", expected: "lookup" },
  { id: "lookup-06", query: "원영적 사고", expected: "lookup" },
  { id: "lookup-07", query: "알잘딱깔센", expected: "lookup" },
  { id: "lookup-08", query: "억텐", expected: "lookup" },

  { id: "situation-01", query: "친구 취향을 따라 할 때 쓰는 밈", expected: "situation" },
  { id: "situation-02", query: "시험을 망쳤지만 태연한 척할 때 쓸 밈", expected: "situation" },
  { id: "situation-03", query: "팀원이 포기하지 않게 응원하는 상황에 맞는 밈", expected: "situation" },
  { id: "situation-04", query: "예상과 완전히 다른 결과가 나왔을 때 쓸 밈", expected: "situation" },
  { id: "situation-05", query: "친구가 같은 말을 계속 반복할 때 어울리는 밈", expected: "situation" },
  { id: "situation-06", query: "일이 잘 풀려서 긍정적으로 생각하고 싶을 때 쓸 밈", expected: "situation" },
  { id: "situation-07", query: "억지로 신난 척하는 사람에게 쓸 밈 추천", expected: "situation" },
  { id: "situation-08", query: "설명하지 않아도 척척 알아듣는 상황에 맞는 밈", expected: "situation" },

  { id: "meaning-01", query: "새삥은 무슨 뜻이야", expected: "meaning" },
  { id: "meaning-02", query: "중꺾마의 의미를 설명해 줘", expected: "meaning" },
  { id: "meaning-03", query: "킹받네가 뭔가요", expected: "meaning" },
  { id: "meaning-04", query: "원영적 사고 뜻", expected: "meaning" },
  { id: "meaning-05", query: "억텐이라는 말은 무엇을 뜻해", expected: "meaning" },
  { id: "meaning-06", query: "알잘딱깔센이 뭐야", expected: "meaning" },
  { id: "meaning-07", query: "도마도마 챌린지는 어떤 밈이야", expected: "meaning" },

  { id: "origin-01", query: "새삥 밈은 어디서 시작됐어", expected: "origin" },
  { id: "origin-02", query: "중꺾마의 유래가 궁금해", expected: "origin" },
  { id: "origin-03", query: "킹받네는 누가 처음 쓴 말이야", expected: "origin" },
  { id: "origin-04", query: "원영적 사고가 언제 생겼어", expected: "origin" },
  { id: "origin-05", query: "알잘딱깔센 기원 알려줘", expected: "origin" },
  { id: "origin-06", query: "억텐이라는 표현은 어디서 나왔어", expected: "origin" },
  { id: "origin-07", query: "도마도마 챌린지의 이른 사례를 알려줘", expected: "origin" },

  { id: "usage-01", query: "새삥은 언제 쓰는 말이야", expected: "usage" },
  { id: "usage-02", query: "중꺾마 사용 예시를 보여줘", expected: "usage" },
  { id: "usage-03", query: "킹받네를 대화에서 어떻게 써", expected: "usage" },
  { id: "usage-04", query: "원영적 사고를 사용할 때 주의할 점", expected: "usage" },
  { id: "usage-05", query: "알잘딱깔센은 어떤 상황에서 사용해", expected: "usage" },
  { id: "usage-06", query: "억텐을 댓글에 쓰는 방법", expected: "usage" },
  { id: "usage-07", query: "도마도마 챌린지를 따라 할 때 주의점", expected: "usage" },

  { id: "out-of-scope-01", query: "오늘 서울 날씨를 알려줘", expected: "out_of_scope" },
  { id: "out-of-scope-02", query: "감자 요리법을 추천해 줘", expected: "out_of_scope" },
  { id: "out-of-scope-03", query: "제주도 여행 일정을 짜 줘", expected: "out_of_scope" },
  { id: "out-of-scope-04", query: "이 문장을 영어로 번역해 줘", expected: "out_of_scope" },
  { id: "out-of-scope-05", query: "자바스크립트 배열 정렬 코드를 작성해 줘", expected: "out_of_scope" },
  { id: "out-of-scope-06", query: "집에서 할 수 있는 스트레칭을 알려줘", expected: "out_of_scope" },
  { id: "out-of-scope-07", query: "지금 한국 시간은 몇 시야", expected: "out_of_scope" },

  { id: "unclear-01", query: "이거 뭐야", expected: "unclear" },
  { id: "unclear-02", query: "그거 알려줘", expected: "unclear" },
  { id: "unclear-03", query: "이런 건 뭐지", expected: "unclear" },
  { id: "unclear-04", query: "뭐가 좋아", expected: "unclear" },
  { id: "unclear-05", query: "그런 느낌 있잖아", expected: "unclear" },
  { id: "unclear-06", query: "아무거나 하나", expected: "unclear" },
] as const satisfies readonly MemeIntentEvaluationCase[];

export type MemeIntentEvaluationOutcome = Readonly<{
  id: string;
  expected: MemeIntent;
  actual: MemeIntent;
  eligible: boolean;
  reason?: MemeIntentReason;
}>;

export type MemeIntentEvaluationSummary = Readonly<{
  required: number;
  completed: number;
  eligible: number;
  correct: number;
  accuracy: number | null;
  approval: "approved" | "below_threshold" | "incomplete";
  fallbackReasons: Readonly<Record<string, number>>;
}>;

type ClassifyMemeIntent = (
  input: { query: string; locale?: string },
) => Promise<MemeIntentDecision>;

export async function evaluateMemeIntentCases({
  cases,
  classify,
}: {
  cases: readonly MemeIntentEvaluationCase[];
  classify: ClassifyMemeIntent;
}): Promise<MemeIntentEvaluationOutcome[]> {
  const outcomes: MemeIntentEvaluationOutcome[] = [];
  for (const testCase of cases) {
    const eligible = canSendMemeIntent(testCase.query);
    const decision = eligible
      ? await classify({ query: testCase.query, locale: "ko" })
      : { intent: testCase.expected, source: "fallback" as const, reason: "input_not_sent" as const };
    outcomes.push({
      id: testCase.id,
      expected: testCase.expected,
      actual: decision.intent,
      eligible,
      reason: decision.reason,
    });
  }
  return outcomes;
}

export function summarizeMemeIntentEvaluation(
  outcomes: readonly MemeIntentEvaluationOutcome[],
  required = MEME_INTENT_EVAL_REQUIRED_CASES,
): MemeIntentEvaluationSummary {
  const completed = outcomes.length;
  const eligible = outcomes.filter((outcome) => outcome.eligible).length;
  const correct = outcomes.filter((outcome) => outcome.eligible && outcome.actual === outcome.expected).length;
  const fallbackReasons = outcomes.reduce<Record<string, number>>((counts, outcome) => {
    if (outcome.reason) counts[outcome.reason] = (counts[outcome.reason] ?? 0) + 1;
    return counts;
  }, {});
  const accuracy = eligible === 0 ? null : correct / eligible;
  const approval = completed < required || eligible < required
    ? "incomplete"
    : accuracy !== null && accuracy >= 0.9
      ? "approved"
      : "below_threshold";

  return { required, completed, eligible, correct, accuracy, approval, fallbackReasons };
}
