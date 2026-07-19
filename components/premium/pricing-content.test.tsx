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
    expect(html).toContain("₩3,900");
    expect(html).toContain('action="/api/billing/checkout"');
    expect(html).toContain('method="post"');
    expect(html).toContain("same email");
    expect(html).toContain("shrink-0 text-right");
    expect(html).toContain("whitespace-nowrap");
  });
});
