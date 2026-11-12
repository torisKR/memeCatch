import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const premium = vi.hoisted(() => ({ value: false }));
const currentLocale = vi.hoisted(() => ({ value: "ko" as "ko" | "en" | "ar" }));

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
  return {
    useLocale: () => ({
      locale: currentLocale.value,
      messages: getMessages(currentLocale.value),
    }),
  };
});

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  beforeEach(() => {
    navigation.pathname = "/";
    premium.value = false;
    currentLocale.value = "ko";
  });

  it("keeps meme destinations in the persistent tab bar", () => {
    navigation.pathname = "/pricing";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain('aria-label="주 내비게이션"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/explore?sort=recent"');
    expect(html).toContain('href="/community"');
    expect(html).not.toContain('href="/products"');
    expect(html).toContain('href="/submit"');
    expect(html).toContain('href="/my"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("min-h-14");
    expect(html).toContain("whitespace-nowrap");
    expect(html.match(/<li class="flex min-w-11 flex-1">/g)).toHaveLength(6);
    expect(html.match(/<a [^>]*class="[^"]*min-h-14 min-w-11/g)).toHaveLength(6);
    expect(html).toContain("min-w-[19.25rem]");
    expect(html.match(/<a href="\/community"[^>]*aria-current="page"/)).toBeFalsy();
  });

  it("marks community and latest destinations current, including their nested routes", () => {
    navigation.pathname = "/community/new";
    const communityHtml = renderToStaticMarkup(<BottomNav />);
    expect(communityHtml.match(/<a href="\/community"[^>]*aria-current="page"/)).toBeTruthy();

    navigation.pathname = "/explore";
    const latestHtml = renderToStaticMarkup(<BottomNav />);
    expect(latestHtml.match(/<a href="\/explore\?sort=recent"[^>]*aria-current="page"/)).toBeTruthy();
  });

  it("keeps localized static links on their real routes", () => {
    currentLocale.value = "en";
    navigation.pathname = "/en/explore";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/en/explore?sort=recent"');
    expect(html).not.toContain('href="/products"');
    expect(html.match(/<a href="\/en\/explore\?sort=recent"[^>]*aria-current="page"/)).toBeTruthy();
  });

  it("uses readable foreground colors for small active and submit labels", () => {
    navigation.pathname = "/explore";
    const html = renderToStaticMarkup(<BottomNav />);
    const activeLink = html.match(/<a href="\/explore\?sort=recent"[^>]*>/)?.[0];
    const submitLink = html.match(/<a href="\/submit"[^>]*>/)?.[0];
    expect(activeLink).toContain("text-accent-text");
    expect(submitLink).toContain("text-accent-text");
  });

  it("preserves nofollow on Submit and MY", () => {
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html.match(/<a href="\/submit" rel="nofollow"/)).toBeTruthy();
    expect(html.match(/<a href="\/my" rel="nofollow"/)).toBeTruthy();
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

  it("translates Home, Latest, Plus, and MY into the existing Arabic wording", () => {
    currentLocale.value = "ar";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain("الرئيسية");
    expect(html).toContain("استكشاف");
    expect(html).toContain("بلس");
    expect(html).toContain("حسابي");
    expect(html).not.toMatch(/>\s*Home\s*</);
    expect(html).not.toMatch(/>\s*Latest\s*</);
    expect(html).not.toMatch(/>\s*Plus\s*</);
    expect(html).not.toMatch(/>\s*MY\s*</);
  });

  it("marks Home current for the Vercel /index alias", () => {
    navigation.pathname = "/index";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html.match(/<a href="\/"[^>]*aria-current="page"/)).toBeTruthy();
  });
});
