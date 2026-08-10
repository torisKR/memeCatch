import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PLUS_OUTCOME_COPY } from "@/lib/plus-outcome-copy";

describe("Plus outcome ledger copy", () => {
  it.each(SUPPORTED_LOCALES)("provides receipt and summary copy for %s", (locale) => {
    const copy = PLUS_OUTCOME_COPY[locale];

    expect(copy.receipt.title).toBeTruthy();
    expect(copy.receipt.channel).toBeTruthy();
    expect(copy.receipt.artifact).toBeTruthy();
    expect(copy.receipt.save).toBeTruthy();
    expect(Object.keys(copy.receipt.channelOptions)).toHaveLength(9);
    expect(Object.keys(copy.receipt.artifactOptions)).toHaveLength(5);
    expect(copy.summary.title).toBeTruthy();
    expect(copy.summary.total(2)).toBeTruthy();
    expect(copy.summary.localeNames.en).toBeTruthy();
    expect(copy.summary.localeNames["zh-tw"]).toBeTruthy();
  });

  it("keeps Traditional Chinese receipt and summary copy distinct", () => {
    const copy = PLUS_OUTCOME_COPY["zh-tw"];

    expect(copy.receipt.title).toBe("使用完成紀錄");
    expect(copy.receipt.save).toBe("完成並儲存紀錄");
    expect(copy.summary.title).toBe("最近7天使用狀況");
    expect(copy.summary.localeNames["zh-tw"]).toBe("繁體中文");
  });
});
