import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlusNextMove } from "@/components/premium/plus-next-move";
import { PLUS_NEXT_MOVE_COPY } from "@/lib/plus-next-move-copy";
import type { PlusNextMoveResult } from "@/lib/plus-next-move";

const result: PlusNextMoveResult = {
  status: "ready",
  item: {
    id: "signal:meme-1",
    memeId: "meme-1",
    shortId: "meme-1",
    slug: "ready-meme",
    title: "Ready meme",
    summary: "Reviewed and ready.",
    locale: "en",
    href: "/en/memes/meme-1-ready-meme",
    shareText: "Ready meme\n\nReviewed and ready.",
    kind: "new_reviewed",
    changedAt: null,
    trendScore: 10,
  },
  signal: "hit",
  confidence: "ready",
  ratedCount: 4,
  ratingScore: 1,
};

describe("PlusNextMove", () => {
  it("renders the personalized candidate without private outcome fields", () => {
    const html = renderToStaticMarkup(
      <PlusNextMove result={result} copy={PLUS_NEXT_MOVE_COPY.en} />,
    );

    expect(html).toContain('data-plus-next-move="ready"');
    expect(html).toContain("Start with this one next");
    expect(html).toContain("Ready meme");
    expect(html).toContain("Similar to a direction that worked for you");
    expect(html).toContain('href="/en/memes/meme-1-ready-meme"');
    expect(html).not.toContain("private");
    expect(html).not.toContain("https://");
  });

  it("renders an activation button when the parent can move the candidate in place", () => {
    const html = renderToStaticMarkup(
      <PlusNextMove result={result} copy={PLUS_NEXT_MOVE_COPY.en} onActivate={() => undefined} />,
    );

    expect(html).toContain('data-plus-next-move-action="activate"');
    expect(html).toContain("Use this for One-Cut");
    expect(html).not.toContain('href="/en/memes/meme-1-ready-meme"');
  });

  it("renders empty and unavailable states distinctly", () => {
    const empty = renderToStaticMarkup(
      <PlusNextMove
        result={{ ...result, status: "empty", item: null }}
        copy={PLUS_NEXT_MOVE_COPY.en}
      />,
    );
    const unavailable = renderToStaticMarkup(
      <PlusNextMove
        result={{ ...result, status: "unavailable", item: null }}
        copy={PLUS_NEXT_MOVE_COPY.en}
      />,
    );

    expect(empty).toContain('data-plus-next-move="empty"');
    expect(empty).toContain("Your next recommendation is warming up");
    expect(unavailable).toContain('data-plus-next-move="unavailable"');
    expect(unavailable).toContain("temporarily unavailable");
  });
});
