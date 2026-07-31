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
  it("renders a localized comparison and POST checkout action", () => {
    const html = renderToStaticMarkup(<PricingContent />);

    expect(html).toContain("Your personal Korean meme trend desk");
    expect(html).toContain("$20");
    expect(html).toContain('action="/api/billing/checkout"');
    expect(html).toContain('method="post"');
    // 자동 갱신이 없다는 사실이 결제 버튼 옆에 반드시 보여야 한다.
    expect(html).toContain("does not auto-renew");
    expect(html).toContain("shrink-0 text-right");
    expect(html).toContain("whitespace-nowrap");
  });
});
