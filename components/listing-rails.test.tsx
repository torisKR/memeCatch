import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { DailyTop10 } from "@/components/daily-top10";
import { RelatedMemes } from "@/components/related-memes";
import type { MemeListItem } from "@/lib/queries";

function related(id: string) {
  return {
    meme: {
      id,
      short_id: id,
      slug: id,
      title: `관련 ${id}`,
      summary: "요약",
      category: "phrase" as const,
      safety_level: "green" as const,
    },
  };
}

function card(id: string): MemeListItem {
  return { id, short_id: id, slug: id, title: `카드 ${id}` } as MemeListItem;
}

describe("listing rails under 3 cards", () => {
  it("hides the related-meme heading and grid below 3 cards", () => {
    const hidden = renderToStaticMarkup(
      <RelatedMemes locale="ko" memes={[related("1"), related("2")]} />,
    );
    const shown = renderToStaticMarkup(
      <RelatedMemes locale="ko" memes={[related("1"), related("2"), related("3")]} />,
    );

    expect(hidden).toBe("");
    expect(shown).toContain("관련 밈");
    expect(shown).toContain("관련 1");
  });

  it("hides the daily strip heading below 3 cards", () => {
    const hidden = renderToStaticMarkup(<DailyTop10 memes={[card("1"), card("2")]} />);
    const shown = renderToStaticMarkup(
      <DailyTop10 memes={[card("1"), card("2"), card("3")]} />,
    );

    expect(hidden).toBe("");
    expect(shown).toContain("오늘 많이 본 밈");
  });

  it("gates the other card rails on the same minimum", () => {
    const files = [
      "app/(default)/search/page.tsx",
      "app/[locale]/search/page.tsx",
      "app/(default)/rankings/page.tsx",
      "app/(default)/timeline/page.tsx",
      "app/(default)/collections/[slug]/page.tsx",
      "components/weekly-digest.tsx",
      "components/news-page-content.tsx",
      "components/trending-carousel.tsx",
      "app/(default)/memes/[key]/page.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toMatch(/hasPublicListing|isThinMeme|omitThinMemes|takeIndexableMemes|koreanDetailRobots/);
    }
    const detail = readFileSync(
      join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
      "utf8",
    );
    expect(detail).toContain("koreanDetailRobots(meme)");
    expect(detail).toContain("!isThinMeme(meme)");
  });
});
