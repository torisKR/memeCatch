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

  it("links to creator product moderation", () => {
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).toContain('href="/admin/creator-products"');
    expect(html).toContain("크리에이터 상품 검토");
  });

  it("marks the creator product moderation link active", () => {
    navigation.pathname = "/admin/creator-products";
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).toMatch(/<a href="\/admin\/creator-products" aria-current="page"/);
  });

  it("links to publisher readiness and marks nested routes active", () => {
    navigation.pathname = "/admin/publisher-readiness";
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).toContain("퍼블리셔 준비도");
    expect(html).toMatch(/<a href="\/admin\/publisher-readiness" aria-current="page"/);
  });

  it("links to video production and publishing and marks it active", () => {
    navigation.pathname = "/admin/video-productions";
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).toContain("영상 제작·발행");
    expect(html).toMatch(/<a href="\/admin\/video-productions" aria-current="page"/);
  });
});
