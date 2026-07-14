import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

vi.mock("@/components/motion-list", () => ({
  MotionList: ({
    as: Tag = "div",
    children,
    ...props
  }: {
    as?: ElementType;
    children: ReactNode;
  } & ComponentPropsWithoutRef<"div">) => <Tag {...props}>{children}</Tag>,
}));

vi.mock("@/components/reveal", () => ({
  Reveal: ({
    as: Tag = "div",
    children,
    ...props
  }: {
    as?: ElementType;
    children: ReactNode;
  } & ComponentPropsWithoutRef<"div">) => <Tag {...props}>{children}</Tag>,
}));

vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: { title: string } }) => <article>{meme.title}</article>,
}));

import { TimelineView } from "@/components/timeline-view";

const meme = {
  id: "meme-1",
  short_id: 1991,
  slug: "test-meme",
  title: "테스트 밈",
  summary: "테스트 요약",
  category: "phrase" as const,
  safety_level: "green" as const,
  lifecycle_status: "active" as const,
  media_type: "image" as const,
  origin_year: 1991,
  trend_score: 1,
  meme_contents: [],
} as unknown as MemeListItem;

describe("TimelineView", () => {
  it("keeps four-digit years on one line and cards inside a responsive grid", () => {
    const html = renderToStaticMarkup(
      <TimelineView
        decades={[
          {
            key: "1990s",
            label: "1990년대",
            years: [{ year: 1991, memes: [meme] }],
          },
        ]}
      />
    );

    expect(html).toContain("sm:w-20");
    expect(html).toContain("lg:w-24");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("lg:grid-cols-4");
    expect(html).not.toContain("sm:overflow-x-auto");
  });
});
