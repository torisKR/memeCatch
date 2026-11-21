import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_CHARS,
  DESCRIPTION_MIN_CHARS,
  memeSeoDescription,
  memeSeoTitle,
  type MemeSeoLocale,
} from "@/lib/meme-seo-copy";
import { getSeoCopy } from "@/lib/i18n-routing";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";

const LOCALES: MemeSeoLocale[] = ["ko", "en", "ja", "zh", "zh-tw"];
const BRAND: Record<MemeSeoLocale, string> = {
  ko: " | 밈캐치", en: " | MemeCatch", ja: " | MemeCatch", zh: " | MemeCatch", "zh-tw": " | MemeCatch",
};
const len = (s: string) => [...s].length;

const rich = {
  summary: "화가 나면서도 웃긴 상황을 표현하는 말",
  originYear: 2020,
  yearPrecision: "unknown",
  safetyLevel: "green",
  usageExampleCount: 2,
  hasOrigin: true,
  hasCaution: true,
};

describe("meme detail titles", () => {
  it("leads with the meme name and the meaning/origin/usage question", () => {
    expect(memeSeoTitle("ko", "킹받네")).toBe("킹받네 뜻·유래, 지금 써도 될까?");
    expect(memeSeoTitle("ko", "대기표 밈", { houseOriginal: true })).toBe("대기표 밈 뜻·제작 배경, 지금 써도 될까?");
    expect(memeSeoTitle("en", "Kingbatne")).toBe("Kingbatne Meaning & Origin: Is It OK to Use?");
    expect(memeSeoTitle("ja", "キンバッネ")).toContain("の意味・由来");
    expect(memeSeoTitle("zh", "气死")).toContain("含义");
    expect(memeSeoTitle("zh-tw", "氣死")).toContain("含義");
  });

  it.each(LOCALES)("keeps ordinary titles within 60 characters with the brand for %s", (locale) => {
    for (const title of ["짧은", "중간 길이의 밈 제목이에요"]) {
      expect(len(memeSeoTitle(locale, title) + BRAND[locale])).toBeLessThanOrEqual(60);
    }
  });

  it("falls back to the shortest pattern for a very long name", () => {
    const long = "아주 아주 긴 밈 제목이 여기에 들어가서 길이가 넘치는 경우를 보는 예시입니다 정말로 아주 길게";
    expect(memeSeoTitle("ko", long)).toBe(`${long} 뜻`);
  });

  it("drops the house-original 유래 wording", () => {
    expect(memeSeoTitle("ko", "대기표 밈", { houseOriginal: true })).not.toContain("유래");
  });
});

describe("meme detail descriptions", () => {
  it.each(LOCALES)("builds a 110-160 character description from DB fields for %s", (locale) => {
    const text = memeSeoDescription(locale, { title: "킹받네", ...rich });
    expect(len(text)).toBeGreaterThanOrEqual(locale === "ko" || locale === "en" ? DESCRIPTION_MIN_CHARS : 90);
    expect(len(text)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(text).toContain(rich.summary);
    expect(text).toContain("2020");
  });

  it("states only stored facts: no year or safety sentence without the field", () => {
    const text = memeSeoDescription("ko", { title: "킹받네", summary: "웃긴 말" });
    expect(text).not.toMatch(/\d{4}년/);
    expect(text).not.toContain("사용 신호는");
    expect(text).not.toContain("예문");
  });

  it("marks an unverified year as an estimate and a definite one plainly", () => {
    expect(memeSeoDescription("ko", { title: "x", summary: "y", originYear: 2019 })).toContain("유행 시작 2019년(추정).");
    expect(memeSeoDescription("ko", { title: "x", summary: "y", originYear: 2019, yearPrecision: "year" })).toContain("유행 시작 2019년.");
  });

  it("uses the Korean safety label from the stored level", () => {
    expect(memeSeoDescription("ko", { title: "x", summary: "y", safetyLevel: "red" })).toContain("'쓰면 위험'");
    expect(memeSeoDescription("en", { title: "x", summary: "y", safetyLevel: "yellow" })).toContain("context matters");
  });

  it("shortens an overlong summary instead of exceeding 160 characters", () => {
    const text = memeSeoDescription("ko", { title: "x", summary: "가".repeat(400), ...{ originYear: 2020 } });
    expect(len(text)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("static page descriptions", () => {
  it("gives the Korean and English home a 110-160 character description", () => {
    for (const locale of ["ko", "en"] as const) {
      const n = len(getSeoCopy(locale).description);
      expect(n).toBeGreaterThanOrEqual(DESCRIPTION_MIN_CHARS);
      expect(n).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    }
  });

  it("no longer ships one-line localized home or explore descriptions", () => {
    for (const locale of ["ja", "zh", "zh-tw"] as const) {
      expect(len(getSeoCopy(locale).description)).toBeGreaterThanOrEqual(90);
      expect(len(LOCALIZED_EXPLORE_COPY[locale].description)).toBeGreaterThanOrEqual(55);
    }
    expect(len(LOCALIZED_EXPLORE_COPY.en.description)).toBeGreaterThanOrEqual(DESCRIPTION_MIN_CHARS);
  });
});
