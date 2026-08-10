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
  return { useLocale: () => ({ locale: "ja", messages: getMessages("ja") }) };
});

import { PremiumGate } from "@/components/premium/premium-gate";

describe("PremiumGate", () => {
  it("explains that the personal radar is a Plus feature", () => {
    const html = renderToStaticMarkup(<PremiumGate />);

    expect(html).toContain("今日使う確認済みミーム1つから始める");
    expect(html).toContain('href="/ja/pricing"');
  });
});
