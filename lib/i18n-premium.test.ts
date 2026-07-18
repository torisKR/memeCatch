import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

describe("PREMIUM_COPY", () => {
  it.each(SUPPORTED_LOCALES)("provides complete Plus copy for %s", (locale) => {
    const copy = PREMIUM_COPY[locale];

    expect(copy.productName).toBe("MemeCatch Plus");
    expect(copy.pricing.title).toBeTruthy();
    expect(copy.pricing.checkout).toBeTruthy();
    expect(copy.dashboard.upgradeTitle).toBeTruthy();
    expect(copy.dashboard.billingHelp).toBeTruthy();
    expect(copy.feed.personalRadar).toBeTruthy();
    expect(copy.save.limitReached).toBeTruthy();
    expect(copy.save.upgrade).toBeTruthy();
    expect(copy.my.previousPage).toBeTruthy();
    expect(copy.my.nextPage).toBeTruthy();
    expect(copy.my.pageStatus(2, 4)).toContain("2");
    expect(copy.my.pageStatus(2, 4)).toContain("4");
  });

  it("describes recurring billing without promising self-service cancellation", () => {
    expect(PREMIUM_COPY.ko.pricing.launchNote).toBe("매월 갱신되는 월간 멤버십");
    expect(PREMIUM_COPY.en.pricing.launchNote).toBe("A monthly recurring membership");
    expect(PREMIUM_COPY.ja.pricing.launchNote).toBe("毎月更新される月額メンバーシップ");
    expect(PREMIUM_COPY.zh.pricing.launchNote).toBe("按月续费的月度会员");
  });

  it.each(SUPPORTED_LOCALES)("does not advertise a free trend-radar preview for %s", (locale) => {
    const trendRadar = PREMIUM_COPY[locale].pricing.features[1];

    expect(trendRadar.free).not.toMatch(/미리보기|preview|プレビュー|预览/i);
  });
});
