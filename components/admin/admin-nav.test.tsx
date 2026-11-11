import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { AdminNav } from "./admin-nav";

describe("AdminNav", () => {
  beforeEach(() => {
    navigation.pathname = "/admin";
  });

  it("does not link to retired creator product moderation", () => {
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).not.toContain('href="/admin/creator-products"');
    expect(html).not.toContain("크리에이터 상품 검토");
  });

  it("links to publisher readiness and marks nested routes active", () => {
    navigation.pathname = "/admin/publisher-readiness";
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).toContain("퍼블리셔 준비도");
    expect(html).toMatch(/<a href="\/admin\/publisher-readiness" aria-current="page"/);
  });
});
