import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "en", messages: getMessages("en") }) };
});

import { PricingContent } from "@/components/premium/pricing-content";

describe("PricingContent", () => {
  it("shows the separate Fairy donation option only with server-approved configuration", () => {
    expect(renderToStaticMarkup(<PricingContent />)).not.toContain("/api/billing/fairy/checkout");
    const html = renderToStaticMarkup(<PricingContent fairyMinimumAmount={15_000} />);
    expect(html).toContain("KRW 15,000");
    expect(html).toContain('action="/api/billing/fairy/checkout"');
    expect(html).toContain("smaller donations are support only");
    expect(html).toContain('href="/premium"');
  });
  it("renders a localized comparison and POST checkout action", () => {
    const html = renderToStaticMarkup(<PricingContent />);

    expect(html).toContain("Get three memes to post today, with platform-ready copy");
    expect(html).toContain("Saved-meme reuse radar");
    expect(html).toContain("Unlimited + radar");
    expect(html).toContain(">10<");
    expect(html).toContain("$10");
    expect(html).toContain('action="/api/billing/checkout"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="locale" value="en"');
    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/en/explore"');
    // 자동 갱신이 없다는 사실이 결제 버튼 옆에 반드시 보여야 한다.
    expect(html).toContain("no auto-renewal");
    expect(html).toContain("Kaia USDT");
    expect(html).toContain("Pay with Kaia USDT");
    expect(html).toContain("Sign in to MemeCatch.");
    expect(html).toContain("Prepare USDT on Kaia in Unifi Wallet.");
    expect(html).toContain("Finish payment, then return to see your Plus status.");
    expect(html).toContain("Explore free memes");
    expect(html).toContain("remaining time preserved");
    expect(html).toContain("original payment wallet");
    expect(html).toContain("shrink-0 text-right");
    expect(html).toContain("whitespace-nowrap");
  });
});
