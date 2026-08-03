/**
 * 랭킹 산식·집계 기준의 단일 출처.
 *
 * 왜 필요한가: 랭킹 화면이 1·2·3위를 정확한 순위처럼 제시하면서 산정 기간도,
 * 마지막 갱신 시각도, 표본 크기도 밝히지 않았다. 2026-08 기준 최근 7일 총 조회는
 * 308회(203개 문서)이고 상위 20개를 합쳐도 107회다 — 순위 1칸 차이가 조회 1~2회다.
 * 이 상태에서 순위를 단정적으로 보여 주면 없는 정밀도를 주장하는 셈이다.
 *
 * 세 탭은 서로 다른 산식을 쓴다. 화면이 그 차이를 설명하지 않으면 사용자는 같은
 * 지표의 다른 기간이라고 오해한다.
 */

export type RankingMethodKey = "today" | "weekly" | "comeback";

export type RankingMethod = {
  /** 집계 기간 — 사용자에게 보이는 표현 */
  period: string;
  /** 산식 한 문장. 화면에 없는 지표를 적지 않는다. */
  formula: string;
};

export const RANKING_METHODS: Record<RankingMethodKey, RankingMethod> = {
  today: {
    period: "최근 3일",
    formula:
      "조회·댓글·반응·저장을 로그 정규화해 합산하고 신고는 감점해요. 최근 48시간에 올라온 밈에는 가산점이 붙어요.",
  },
  weekly: {
    period: "최근 7일",
    formula: "기간 안의 조회 수만 단순 합산해요. 다른 반응은 반영하지 않아요.",
  },
  comeback: {
    period: "최근 3일",
    formula:
      "공개된 지 90일이 넘었는데 지금 다시 점수가 오른 밈만 모아요. 점수 산식은 급상승과 같아요.",
  },
};

/**
 * 순위를 단정해도 되는 최소 표본 — 1위 문서의 기간 내 조회 수 기준.
 *
 * 30회 미만이면 조회 1~2회 차이로 순위가 뒤바뀐다. 그 구간에서는 "1위/2위"가
 * 실제 인기 차이를 뜻하지 않으므로 화면에 표본이 적다는 사실을 함께 밝힌다.
 * 트래픽이 늘면 이 경고는 자동으로 사라진다.
 */
export const LOW_SAMPLE_TOP_VIEWS = 30;

/** 상위 문서의 조회 수가 순위를 지지하지 못하는가. */
export function isLowSample(topViews: number | null | undefined): boolean {
  return typeof topViews !== "number" ||
    !Number.isFinite(topViews) ||
    topViews < LOW_SAMPLE_TOP_VIEWS;
}

/** 마지막 집계일(YYYY-MM-DD) → 화면 표기. 값이 없으면 null로 두고 호출부가 생략한다. */
export function formatRollupDate(date: string | null | undefined): string | null {
  if (!date) return null;
  // meme_trend_metrics.date는 compute_trend_scores()가 Asia/Seoul 기준으로 넣는다.
  const parsed = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}
