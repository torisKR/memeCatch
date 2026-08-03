import { describe, expect, it } from "vitest";
import {
  LOW_SAMPLE_TOP_VIEWS,
  RANKING_METHODS,
  formatRollupDate,
  isLowSample,
} from "./methods";

describe("isLowSample", () => {
  it("임계치 미만이면 표본이 부족하다고 본다", () => {
    // 2026-08 실측: 최근 7일 총 조회 308회, 상위 20개 합계 107회 → 순위 1칸이 조회 1~2회.
    expect(isLowSample(0)).toBe(true);
    expect(isLowSample(29)).toBe(true);
    expect(isLowSample(LOW_SAMPLE_TOP_VIEWS - 1)).toBe(true);
  });

  it("임계치 이상이면 순위를 단정해도 된다고 본다", () => {
    expect(isLowSample(LOW_SAMPLE_TOP_VIEWS)).toBe(false);
    expect(isLowSample(1000)).toBe(false);
  });

  it("값이 없거나 숫자가 아니면 보수적으로 표본 부족으로 본다", () => {
    expect(isLowSample(null)).toBe(true);
    expect(isLowSample(undefined)).toBe(true);
    expect(isLowSample(Number.NaN)).toBe(true);
  });
});

describe("formatRollupDate", () => {
  it("KST 기준 날짜를 한국어 표기로 바꾼다", () => {
    // compute_trend_scores()가 Asia/Seoul 기준으로 넣는 날짜라 KST로 읽어야 한다.
    expect(formatRollupDate("2026-08-04")).toBe("2026년 8월 4일");
  });

  it("값이 없거나 형식이 깨지면 null을 돌려 호출부가 생략하게 한다", () => {
    expect(formatRollupDate(null)).toBeNull();
    expect(formatRollupDate(undefined)).toBeNull();
    expect(formatRollupDate("")).toBeNull();
    expect(formatRollupDate("어제")).toBeNull();
  });
});

describe("RANKING_METHODS", () => {
  it("세 탭이 각각 기간과 산식을 갖는다", () => {
    for (const key of ["today", "weekly", "comeback"] as const) {
      expect(RANKING_METHODS[key].period.length).toBeGreaterThan(0);
      expect(RANKING_METHODS[key].formula.length).toBeGreaterThan(0);
    }
  });

  it("주간 탭은 조회만 쓴다는 사실을 밝힌다 — 급상승과 산식이 다르다", () => {
    expect(RANKING_METHODS.weekly.period).toBe("최근 7일");
    expect(RANKING_METHODS.weekly.formula).toContain("조회");
    expect(RANKING_METHODS.today.formula).not.toBe(RANKING_METHODS.weekly.formula);
  });
});
