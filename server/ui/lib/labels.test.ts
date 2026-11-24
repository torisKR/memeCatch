import { describe, expect, it } from "vitest";
import {
  DEFINITE_YEAR_PRECISIONS,
  expandDisplayCategoryTokens,
  expandToLegacyCategories,
  formatOriginYear,
} from "./labels";

describe("display categories", () => {
  it("keeps AI memes as a tag-backed category instead of a DB enum", () => {
    const display = expandDisplayCategoryTokens(["ai-meme"]);
    expect(display).toEqual(["ai-meme"]);
    expect(expandToLegacyCategories(display)).toEqual(["phrase", "image"]);
  });
});

describe("formatOriginYear", () => {
  it("근거가 뒷받침하는 정밀도에서만 연도를 단정한다", () => {
    for (const precision of DEFINITE_YEAR_PRECISIONS) {
      expect(formatOriginYear(2016, precision)).toBe("2016년생 밈");
    }
  });

  it("정밀도가 약하면 추정임을 함께 밝힌다", () => {
    // 공개 문서 3,904건 전부 year_precision='unknown' — 지금은 이 분기가 기본값이다.
    for (const precision of ["approximate", "decade", "unknown"]) {
      expect(formatOriginYear(2016, precision)).toBe("2016년생 밈 (추정)");
    }
  });

  it("정밀도를 모르면 단정하지 않는다", () => {
    expect(formatOriginYear(2016)).toBe("2016년생 밈 (추정)");
    expect(formatOriginYear(2016, null)).toBe("2016년생 밈 (추정)");
  });

  it("연도가 없으면 칩을 아예 렌더하지 않도록 null을 돌려준다", () => {
    expect(formatOriginYear(null, "exact")).toBeNull();
    expect(formatOriginYear(undefined, "exact")).toBeNull();
    expect(formatOriginYear(Number.NaN, "exact")).toBeNull();
  });
});
