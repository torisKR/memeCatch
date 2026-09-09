import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const premium = vi.hoisted(() => ({ value: false }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/lib/hooks/use-premium", () => ({
  usePremium: () => premium.value,
}));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "ko", messages: getMessages("ko") }) };
});

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  beforeEach(() => {
    navigation.pathname = "/";
    premium.value = false;
  });

  it("keeps the core mobile destinations without Community", () => {
    navigation.pathname = "/pricing";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain('aria-label="주 내비게이션"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/explore"');
    expect(html).toContain('href="/submit"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/my"');
    expect(html).not.toContain('href="/community"');
    expect(html.match(/<a href="\/pricing"[^>]*aria-current="page"/)).toBeTruthy();
  });

  it("sends Plus subscribers to the premium dashboard", () => {
    premium.value = true;
    navigation.pathname = "/premium";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain('href="/premium"');
    expect(html.match(/<a href="\/premium"[^>]*aria-current="page"/)).toBeTruthy();
    expect(html).not.toContain('href="/pricing"');
  });

  it("stays hidden on admin routes", () => {
    navigation.pathname = "/admin/growth";
    expect(renderToStaticMarkup(<BottomNav />)).toBe("");
  });

  it("marks Home current for the Vercel /index alias", () => {
    navigation.pathname = "/index";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html.match(/<a href="\/"[^>]*aria-current="page"/)).toBeTruthy();
  });
});
