import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PlusTranslationFulfillmentCenter,
  type PlusTranslationFulfillmentCopy,
} from "@/components/premium/plus-translation-fulfillment-center";
import type { PlusTranslationFulfillmentResult } from "@/lib/plus-translation-fulfillment";

const copy: PlusTranslationFulfillmentCopy = {
  heading: "Reviewed translation fulfillment",
  body: "Track each owner request through review and delivery.",
  statusLabels: {
    requested: "Requested",
    in_review: "In review",
    ready: "Ready",
    stale: "Needs refresh",
    source_incomplete: "Source needs more context",
    dismissed: "Dismissed",
  },
  timestampLabels: {
    requested: "Requested at",
    in_review: "Updated at",
    ready: "Completed at",
    stale: "Completion checked at",
    source_incomplete: "Source checked at",
    dismissed: "Dismissed at",
  },
  openLink: "Open translation",
  empty: {
    heading: "No translation requests",
    body: "Your reviewed translation queue is empty.",
  },
  unavailable: {
    heading: "Requests unavailable",
    body: "Translation request status could not be loaded.",
  },
};

const active: PlusTranslationFulfillmentResult = {
  status: "active",
  items: [
    {
      requestId: "request-ja",
      memeId: "meme-ja",
      shortId: "m123",
      slug: "localized-slug",
      title: "Localized meme",
      locale: "ja",
      requestStatus: "completed",
      state: "ready",
      changedAt: "2026-08-09T02:00:00.000Z",
    },
    {
      requestId: "request-pending",
      memeId: "meme-pending",
      shortId: "m124",
      slug: "pending-slug",
      title: "Pending meme",
      locale: "en",
      requestStatus: "in_review",
      state: "in_review",
      changedAt: "2026-08-09T03:00:00.000Z",
    },
  ],
};

describe("PlusTranslationFulfillmentCenter", () => {
  it("server-renders state, timestamp, and the exact requested-locale detail link", () => {
    const html = renderToStaticMarkup(
      <PlusTranslationFulfillmentCenter
        fulfillment={active}
        locale="en"
        copy={copy}
      />,
    );

    expect(html).toContain('data-plus-translation-fulfillment="active"');
    expect(html).toContain('data-fulfillment-state="ready"');
    expect(html).toContain('data-request-status="completed"');
    expect(html).toContain("Completed at");
    expect(html).toContain('<time dateTime="2026-08-09T02:00:00.000Z">');
    expect(html).toContain('href="/ja/memes/m123-localized-slug"');
    expect(html).not.toContain('href="/memes/m123-localized-slug"');
    expect(html).toContain('data-fulfillment-state="in_review"');
    expect(html).not.toContain('href="/en/memes/m124-pending-slug"');
  });

  it("renders a successful empty state", () => {
    const html = renderToStaticMarkup(
      <PlusTranslationFulfillmentCenter
        fulfillment={{ status: "empty", items: [] }}
        locale="ko"
        copy={copy}
      />,
    );

    expect(html).toContain('data-plus-translation-fulfillment="empty"');
    expect(html).toContain(copy.empty.heading);
    expect(html).toContain(copy.empty.body);
    expect(html).not.toContain(copy.unavailable.heading);
  });

  it("does not link a reviewed translation while its source is too thin for public indexing", () => {
    const html = renderToStaticMarkup(
      <PlusTranslationFulfillmentCenter
        fulfillment={{
          status: "active",
          items: [
            {
              ...active.items[0],
              requestId: "request-thin",
              state: "source_incomplete",
              title: "Thin source",
            },
          ],
        }}
        locale="en"
        copy={copy}
      />,
    );

    expect(html).toContain('data-fulfillment-state="source_incomplete"');
    expect(html).toContain("Source needs more context");
    expect(html).not.toContain('href="/ja/memes/m123-localized-slug"');
  });

  it("renders an unavailable read separately from an empty queue", () => {
    const html = renderToStaticMarkup(
      <PlusTranslationFulfillmentCenter
        fulfillment={{ status: "unavailable", items: [] }}
        locale="en"
        copy={copy}
      />,
    );

    expect(html).toContain('data-plus-translation-fulfillment="unavailable"');
    expect(html).toContain(copy.unavailable.heading);
    expect(html).toContain(copy.unavailable.body);
    expect(html).not.toContain(copy.empty.heading);
  });
});
