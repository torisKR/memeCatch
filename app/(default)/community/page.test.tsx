import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createStaticClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: () => Promise.resolve(fixtures.result),
      };
      return query;
    },
  }),
}));

vi.mock("@/components/community-post-card", () => ({
  CommunityPostCard: () => <article>커뮤니티 글</article>,
}));

import CommunityPage from "./page";
import CommunityLoading from "./loading";

describe("Community discovery states", () => {
  beforeEach(() => {
    fixtures.result = { data: [], error: null };
  });

  it("keeps posting and discovery actions visible when the feed is empty", async () => {
    const html = renderToStaticMarkup(
      await CommunityPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('href="/community/new"');
    expect(html).toContain('href="/explore"');
    expect(html).toContain("첫 글 쓰기");
  });

  it("keeps a participation path available when the feed request fails", async () => {
    fixtures.result = { data: null, error: new Error("offline") };
    const html = renderToStaticMarkup(
      await CommunityPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/community"');
    expect(html).toContain('href="/community/new"');
  });

  it("keeps the create-post action available while loading", () => {
    const html = renderToStaticMarkup(<CommunityLoading />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('href="/community/new"');
    expect(html).toContain("글쓰기");
  });
});
