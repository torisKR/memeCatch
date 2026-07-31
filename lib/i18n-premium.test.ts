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

  it("states the pass does not auto-renew", () => {
    // Unifi Pay에는 정기결제 API가 없다(1회 결제 = 30일 이용권). 자동 갱신을
    // 약속하면 오지 않을 갱신을 기다리게 만드는 거짓 안내가 된다.
    expect(PREMIUM_COPY.ko.pricing.launchNote).toBe("30일 이용권 · 자동 갱신 없음");
    expect(PREMIUM_COPY.en.pricing.launchNote).toBe("30-day pass · does not auto-renew");
    expect(PREMIUM_COPY.ja.pricing.launchNote).toBe("30日間の利用券・自動更新なし");
    expect(PREMIUM_COPY.zh.pricing.launchNote).toBe("30天使用权 · 不自动续费");
  });

  it.each(SUPPORTED_LOCALES)("never promises recurring billing for %s", (locale) => {
    const { launchNote, perMonth, sameEmail } = PREMIUM_COPY[locale].pricing;
    const claims = `${launchNote} ${perMonth} ${sameEmail}`;

    // 중국어는 "不自动续费"(자동갱신 없음)처럼 부정형에도 '续费'가 들어간다.
    // 갱신을 약속하는 표현만 골라서 본다.
    expect(claims).not.toMatch(
      /매월|월간|monthly|recurring|毎月|月額|按月续费|按月訂閱|月度会员|月度會員/i,
    );
    // 결제 제공자가 바뀌었다 — 이전 제공자명이 남아 있으면 안내가 어긋난다.
    expect(claims).not.toMatch(/래피드|Latpeed/i);
  });

  it.each(SUPPORTED_LOCALES)(
    "prices the pass in a currency Unifi Pay supports for %s",
    (locale) => {
      // Unifi Pay는 USD·JPY만 지원한다(KRW 불가).
      expect(PREMIUM_COPY[locale].pricing.monthly).toBe("$20");
    },
  );

  it.each(SUPPORTED_LOCALES)("does not advertise a free trend-radar preview for %s", (locale) => {
    const trendRadar = PREMIUM_COPY[locale].pricing.features[1];

    expect(trendRadar.free).not.toMatch(/미리보기|preview|プレビュー|预览/i);
  });
});
