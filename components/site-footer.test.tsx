import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/auth-menu", () => ({
  HideOnAdmin: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({ locale: "ko" as const, messages: getMessages("ko") }),
  };
});

import { SiteFooter } from "@/components/site-footer";

describe("SiteFooter", () => {
  it("links Korean pages to the public contact address", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain('href="/contact"');
    expect(html).toContain(">문의<");
    expect(html).toContain('href="/rankings"');
  });

  it("hides rankings when the published list cannot be built", () => {
    const html = renderToStaticMarkup(<SiteFooter showRankings={false} />);
    expect(html).not.toContain('href="/rankings"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="/contact"');
  });
});
