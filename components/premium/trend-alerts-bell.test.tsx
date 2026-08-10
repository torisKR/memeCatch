import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-premium", () => ({ usePremium: () => true }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "en", messages: getMessages("en") }) };
});

import {
  TREND_ALERTS_INTERESTS_HREF,
  TrendAlertsBell,
  trendAlertKindLabel,
} from "@/components/premium/trend-alerts-bell";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

describe("TrendAlertsBell", () => {
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
});
