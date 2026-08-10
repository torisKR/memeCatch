import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlusDailySignalSettings } from "@/components/premium/plus-daily-signal-settings";

vi.mock("@/lib/i18n-client", () => ({
  useLocale: () => ({ locale: "en" }),
}));

describe("PlusDailySignalSettings", () => {
  it("renders the opt-in control and supported language choices", () => {
    const html = renderToStaticMarkup(
      <PlusDailySignalSettings enabled={false} preferredLocale="en" />,
    );

    expect(html).toContain("Daily Signal email");
    expect(html).toContain("Send me the email");
    expect(html).toContain("Email language");
    expect(html).toContain('data-daily-signal-enabled="false"');
    expect(html).toContain("日本語");
  });

  it("renders an enabled state without exposing private delivery data", () => {
    const html = renderToStaticMarkup(
      <PlusDailySignalSettings enabled preferredLocale="ja" />,
    );

    expect(html).toContain('data-daily-signal-enabled="true"');
    expect(html).toContain('value="ja"');
    expect(html).not.toContain("deliveryUrl");
    expect(html).not.toContain("user_id");
  });
});
