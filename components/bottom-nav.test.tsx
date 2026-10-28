import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const currentLocale = vi.hoisted(() => ({ value: "ko" as "ko" | "en" }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
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
    currentLocale.value = "ko";
  });

  it("keeps four primary destinations that fit small screens", () => {
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain('aria-label="주 내비게이션"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/explore"');
    expect(html).toContain('href="/community"');
    expect(html).toContain('href="/my"');
    expect(html).not.toContain('href="/products"');
    expect(html).not.toContain('href="/submit"');
    expect(html).not.toContain('href="/pricing"');
    expect(html).toContain("min-h-14");
    expect(html).toContain("whitespace-nowrap");
    expect(html.match(/<li class="flex min-w-11 flex-1">/g)).toHaveLength(4);
    expect(html.match(/<a [^>]*class="[^"]*min-h-14 min-w-11/g)).toHaveLength(4);
    expect(html).not.toContain("min-w-[19.25rem]");
    expect(html.match(/<a href="\/community"[^>]*aria-current="page"/)).toBeFalsy();
  });

  it("marks community and latest destinations current, including their nested routes", () => {
    navigation.pathname = "/community/new";
    const communityHtml = renderToStaticMarkup(<BottomNav />);
    expect(communityHtml.match(/<a href="\/community"[^>]*aria-current="page"/)).toBeTruthy();

    navigation.pathname = "/explore";
    const latestHtml = renderToStaticMarkup(<BottomNav />);
    expect(latestHtml.match(/<a href="\/explore"[^>]*aria-current="page"/)).toBeTruthy();
  });

  it("keeps localized static links", () => {
    currentLocale.value = "en";
    navigation.pathname = "/en/explore";
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/en/explore"');
    expect(html.match(/<a href="\/en\/explore"[^>]*aria-current="page"/)).toBeTruthy();
  });

  it("uses readable foreground colors for the active label", () => {
    navigation.pathname = "/explore";
    const html = renderToStaticMarkup(<BottomNav />);
    const activeLink = html.match(/<a href="\/explore"[^>]*>/)?.[0];
    expect(activeLink).toContain("text-accent-text");
  });

  it("preserves nofollow on MY", () => {
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html.match(/<a href="\/my" rel="nofollow"/)).toBeTruthy();
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
