import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "zh", messages: getMessages("zh") }) };
});

import { PremiumDashboardContent } from "@/components/premium/premium-dashboard-content";

describe("PremiumDashboardContent", () => {
  it("shows the active membership and its protected feed", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium
        status="active"
        currentPeriodEnd="2026-08-18T00:00:00+09:00"
        feed={<div>protected feed</div>}
      />,
    );

    expect(html).toContain("抢先掌握今天的趋势");
    expect(html).toContain("使用中");
    expect(html).toContain("protected feed");
  });
});
