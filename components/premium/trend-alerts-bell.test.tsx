import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const premiumState = vi.hoisted(() => ({ value: true }));
const localeState = vi.hoisted(() => ({ value: "en" as "en" | "zh-tw" }));

vi.mock("@/lib/hooks/use-premium", () => ({ usePremium: () => premiumState.value }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({
      locale: localeState.value,
      messages: getMessages(localeState.value),
    }),
  };
});

import {
  TREND_ALERTS_INTERESTS_HREF,
  TrendAlertsBell,
  trendAlertKindLabel,
} from "@/components/premium/trend-alerts-bell";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

describe("TrendAlertsBell", () => {
  beforeEach(() => {
    premiumState.value = true;
    localeState.value = "en";
  });

  it("uses the active locale for its accessible trigger", () => {
    const html = renderToStaticMarkup(<TrendAlertsBell />);

    expect(html).toContain('aria-label="Trend alerts"');
    expect(html).not.toContain('aria-label="트렌드 알림"');
  });

  it("distinguishes a saved-meme signal from a category signal", () => {
    expect(trendAlertKindLabel("saved_rising", PREMIUM_COPY.ja.alerts)).toBe("保存したミームが急上昇");
    expect(trendAlertKindLabel("rising", PREMIUM_COPY.ja.alerts)).toBe("興味のある話題が急上昇");
  });

  it("sends interest management to the existing onboarding recovery path", () => {
    expect(TREND_ALERTS_INTERESTS_HREF).toBe("/onboarding?next=/premium");
    expect(TREND_ALERTS_INTERESTS_HREF).not.toContain("/my/interests");
  });

  it("routes alert and briefing setup intent to attributed pricing for free users", () => {
    premiumState.value = false;
    const html = renderToStaticMarkup(<TrendAlertsBell />);

    expect(html).toContain('href="/en/pricing?source=alert_briefing_setup"');
    expect(html).toContain('aria-label="Trend alerts · Plus"');
  });

  it("uses Traditional Chinese for the zh-tw alert trigger", () => {
    localeState.value = "zh-tw";
    const html = renderToStaticMarkup(<TrendAlertsBell />);

    expect(html).toContain('aria-label="趨勢提醒"');
    expect(html).not.toContain('aria-label="趋势提醒"');
  });
});
