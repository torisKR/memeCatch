import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PlusGlobalScout,
  type PlusGlobalScoutItem,
} from "@/components/premium/plus-global-scout";
import { PLUS_GLOBAL_SCOUT_COPY } from "@/lib/plus-global-scout-copy";

const item: PlusGlobalScoutItem = {
  id: "global-one",
  shortId: "g01",
  slug: "global-one",
  title: "Global One",
  summary: "A reviewed global meme that is current today.",
  description: "A complete reviewed description.",
  origin: "A documented global origin.",
  safetyLevel: "yellow",
  lifecycleStatus: "rising",
  usageNote: "Use it as a quick reaction.",
  caution: "Avoid formal announcements.",
  locale: "en",
  trendScore: 80,
  sourceUpdatedAt: "2026-08-09T00:00:00.000Z",
};

describe("PlusGlobalScout", () => {
  it.each([
    ["ko", "오늘의 글로벌 스카우트 덱"],
    ["en", "Today’s Global Scout Deck"],
    ["ja", "今日のグローバル・スカウトデッキ"],
    ["zh", "今日全球侦察卡组"],
    ["zh-tw", "今日全球偵察卡組"],
  ] as const)("selects the dedicated %s copy", (locale, title) => {
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale={locale} items={[]} dateLabel="Deck 077" />,
    );

    expect(html).toContain(title);
    expect(html).toContain(PLUS_GLOBAL_SCOUT_COPY[locale].emptyTitle);
    expect(html).toContain("Deck 077");
  });

  it.each([
    ["ko", "/memes/g01-global-one"],
    ["en", "/en/memes/g01-global-one"],
    ["ja", "/ja/memes/g01-global-one"],
    ["zh", "/zh/memes/g01-global-one"],
    ["zh-tw", "/zh-tw/memes/g01-global-one"],
  ] as const)("uses the locale-safe %s meme path", (locale, href) => {
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale={locale} items={[{ ...item, locale }]} dateKey="2026-08-09" />,
    );

    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('dateTime="2026-08-09"');
  });

  it("keeps an English fallback card on the English route and discloses its content language", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale="ja" items={[item]} dateKey="2026-08-09" />,
    );

    expect(html).toContain('href="/en/memes/g01-global-one"');
    expect(html).toContain('data-deck-content-locale="en"');
    expect(html).toContain('lang="en-US"');
    expect(html).toContain("コンテンツ言語: English");
  });

  it("keeps normalized English content honest for a UI-only display locale", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale="en" displayLocale="th" items={[item]} dateKey="2026-08-09" />,
    );

    expect(html).toContain('lang="en-US"');
    expect(html).toContain('data-deck-content-locale="en"');
    expect(html).toContain('data-deck-display-locale="th"');
    expect(html).toContain('href="/en/memes/g01-global-one"');
    expect(html).toContain("Content language: English");
  });

  it("renders safety, lifecycle, proof, optional guidance, and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale="en" items={[item]} dateKey="2026-08-09" />,
    );

    expect(html).toContain('aria-labelledby="plus-global-scout-title"');
    expect(html).toContain('data-plus-global-scout="active"');
    expect(html).toContain('data-deck-count="1"');
    expect(html).toContain('data-deck-date="2026-08-09"');
    expect(html).toContain('data-scout-card="global-one"');
    expect(html).toContain('data-safety="yellow"');
    expect(html).toContain('data-lifecycle="rising"');
    expect(html).toContain("Reviewed");
    expect(html).toContain("Current");
    expect(html).toContain("Safety: Check the context");
    expect(html).toContain("Lifecycle: Rising");
    expect(html).toContain("Usage");
    expect(html).toContain("Use it as a quick reaction.");
    expect(html).toContain("Caution");
    expect(html).toContain("Avoid formal announcements.");
    expect(html).toContain('aria-label="Global One — Open meme details"');
  });

  it("renders a localized empty state and omits optional guidance when absent", () => {
    const empty = renderToStaticMarkup(
      <PlusGlobalScout locale="zh-tw" items={[]} dateKey="2026-08-09" />,
    );
    const withoutGuidance = renderToStaticMarkup(
      <PlusGlobalScout
        locale="ja"
        items={[{ ...item, locale: "ja", usageNote: null, caution: null }]}
        dateKey="2026-08-09"
      />,
    );

    expect(empty).toContain('data-plus-global-scout="empty"');
    expect(empty).toContain('data-deck-count="0"');
    expect(empty).toContain('role="status"');
    expect(empty).toContain(PLUS_GLOBAL_SCOUT_COPY["zh-tw"].emptyBody);
    expect(withoutGuidance).not.toContain(PLUS_GLOBAL_SCOUT_COPY.ja.usageLabel);
    expect(withoutGuidance).not.toContain(PLUS_GLOBAL_SCOUT_COPY.ja.cautionLabel);
  });

  it("keeps an unavailable read distinct from an empty reviewed deck", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale="en" status="unavailable" items={[]} dateKey="2026-08-09" />,
    );

    expect(html).toContain('data-plus-global-scout="unavailable"');
    expect(html).toContain(PLUS_GLOBAL_SCOUT_COPY.en.unavailableTitle);
    expect(html).toContain(PLUS_GLOBAL_SCOUT_COPY.en.unavailableBody);
    expect(html).not.toContain(PLUS_GLOBAL_SCOUT_COPY.en.emptyTitle);
  });

  it("caps the deck at five linked cards", () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      ...item,
      id: `global-${index}`,
      shortId: `g${index}`,
      title: `Global ${index}`,
    }));
    const html = renderToStaticMarkup(
      <PlusGlobalScout locale="en" items={items} dateKey="2026-08-09" />,
    );

    expect(html).toContain('data-deck-count="5"');
    expect(html.match(/data-scout-card=/g)).toHaveLength(5);
    expect(html).not.toContain("Global 5");
  });
});
