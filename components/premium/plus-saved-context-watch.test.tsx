import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PlusSavedContextWatch,
  savedContextWatchKindLabel,
} from "@/components/premium/plus-saved-context-watch";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

const item = {
  id: "meme-1",
  shortId: "meme-1",
  slug: "meme-one",
  title: "Meme one",
  kind: "translation_stale" as const,
  locale: "en",
  changedAt: "2026-08-09T01:00:00.000Z",
  readAt: null,
};

describe("PlusSavedContextWatch", () => {
  it("renders an unread localized change with a detail link", () => {
    const html = renderToStaticMarkup(
      <PlusSavedContextWatch items={[item]} locale="en" savedCount={4} />,
    );

    expect(html).toContain("Changes to your saved memes");
    expect(html).toContain("Translation needs review");
    expect(html).toContain("Unread");
    expect(html).toContain('href="/en/memes/meme-1-meme-one#');
    expect(html).toContain("Mark all read");
  });

  it("falls back to a useful monitoring message for an empty library", () => {
    const html = renderToStaticMarkup(
      <PlusSavedContextWatch items={[]} locale="ja" savedCount={0} />,
    );

    expect(html).toContain("ミームを保存すると");
    expect(html).toContain('data-plus-context-watch="empty"');
  });

  it("keeps kind labels in the active locale", () => {
    expect(
      savedContextWatchKindLabel("safety_update", PREMIUM_COPY.ko.dashboard.contextWatch),
    ).toBe("안전 신호 변경");
  });
});
