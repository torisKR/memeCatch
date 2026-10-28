import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/components/auth-menu", () => ({
  HideOnAdmin: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({ locale: "ko", messages: getMessages("ko") }),
  };
});

import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("keeps essential trust links and removes promotional destinations", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    for (const href of ["/about", "/editorial", "/privacy", "/terms", "/support"]) {
      expect(html).toContain(`href="${href}"`);
    }
    for (const href of ["/rankings", "/news", "/products", "/submit", "/pricing"]) {
      expect(html).not.toContain(`href="${href}"`);
    }
  });

  it("renders each legal notice once behind one disclosure", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html.match(/운영·저작권 안내/g)).toHaveLength(1);
    expect(html.match(/mailto:/g)).toHaveLength(1);
  });
});
