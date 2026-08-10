// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

import { PlusOutcomeHistory } from "@/components/premium/plus-outcome-history";
import { PLUS_OUTCOME_HISTORY_COPY } from "@/lib/plus-outcome-history-copy";

const history = {
  status: "ready" as const,
  pendingCount: 1,
  items: [
    {
      receiptId: "receipt-1",
      completionDate: "2026-08-09",
      title: "Global threads use",
      channel: "threads" as const,
      locale: "en" as const,
      artifactKind: "creator_pack" as const,
      hasPerformanceNote: true,
      performanceRating: "hit" as const,
      resultUrl: "https://example.com/post/1",
      replayShortId: "meme-1",
      href: "/en/memes/meme-1-global",
      linkStatus: "localized" as const,
    },
    {
      receiptId: "receipt-2",
      completionDate: "2026-08-08",
      title: "Instagram draft",
      channel: "instagram" as const,
      locale: "ja" as const,
      artifactKind: "caption" as const,
      hasPerformanceNote: false,
      performanceRating: null,
      href: "/memes/meme-2-instagram",
      linkStatus: "korean-fallback" as const,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  navigation.refresh.mockReset();
});

describe("PlusOutcomeHistory", () => {
  it("shows bounded outcome metadata and keeps private fields out of the UI", () => {
    const html = render(
      <PlusOutcomeHistory
        history={history}
        locale="en"
      />,
    );

    expect(html.container.textContent).toContain("My use history");
    expect(html.container.textContent).toContain("Global threads use");
    expect(html.container.textContent).toContain("Performance note");
    expect(html.container.textContent).not.toContain("Good replies");
    expect(html.container.textContent).toContain("Not rated");
    expect(html.container.textContent).toContain("English");
    expect(html.container.querySelector('a[href="/en/memes/meme-1-global"]')).toBeTruthy();
    const resultLink = html.container.querySelector("[data-plus-outcome-history-result]");
    expect(resultLink).toBeTruthy();
    expect(resultLink?.getAttribute("href")).toBe("https://example.com/post/1");
    expect(resultLink?.getAttribute("target")).toBe("_blank");
    expect(resultLink?.getAttribute("rel")).toBe("noreferrer noopener");
    const replayLink = html.container.querySelector("[data-plus-outcome-history-replay]");
    expect(replayLink).toBeTruthy();
    expect(replayLink?.getAttribute("href")).toBe(
      "/premium?replay=meme-1&replay_locale=en&from=outcome_history",
    );
    expect(html.container.textContent).toContain("Recreate this hit");
    expect(html.container.textContent).toContain("Open saved result");
    expect(
      html.container.querySelector('[data-plus-outcome-history-link-status="localized"]'),
    ).toBeTruthy();
    expect(html.container.textContent).toContain("Korean original");
    expect(html.container.textContent).not.toContain("private-meme-1");
    expect(html.container.textContent).not.toContain("private note");
    expect(html.container.textContent).not.toContain("private.example");
  });

  it("filters by channel and rating without a new write", () => {
    render(
      <PlusOutcomeHistory
        history={history}
        locale="en"
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Channel" }), {
      target: { value: "instagram" },
    });
    expect(screen.getByText("Instagram draft")).toBeTruthy();
    expect(screen.queryByText("Global threads use")).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Rating" }), {
      target: { value: "hit" },
    });
    expect(screen.getByText("No records match these filters.")).toBeTruthy();
  });

  it("marks an active replay instead of repeating the same CTA", () => {
    const { container } = render(
      <PlusOutcomeHistory
        history={history}
        locale="en"
        activeReplay={{ shortId: "meme-1", locale: "en" }}
      />,
    );

    expect(container.querySelector("[data-plus-outcome-history-replay='active']")).toBeTruthy();
    expect(container.querySelector("[data-plus-outcome-history-replay][href]")).toBeNull();
    expect(container.textContent).toContain("Currently open");
  });

  it("opens a rating CTA only for unrated history and refreshes the snapshot after saving", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updated: true,
        receiptId: "receipt-2",
        performanceRating: "neutral",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <PlusOutcomeHistory
        history={history}
        locale="en"
      />,
    );

    const ratedItem = container.querySelector('[data-plus-outcome-history-item="hit"]');
    const unratedItem = container.querySelector('[data-plus-outcome-history-item="unrated"]');
    expect(ratedItem).toBeTruthy();
    expect(unratedItem).toBeTruthy();
    expect(within(ratedItem as HTMLElement).queryByRole("button", { name: "Rate this use" })).toBeNull();
    fireEvent.click(
      within(unratedItem as HTMLElement).getByRole("button", { name: "Rate this use" }),
    );
    expect(
      within(unratedItem as HTMLElement).getByRole("group", { name: /How did this use go/ }),
    ).toBeTruthy();

    fireEvent.click(within(unratedItem as HTMLElement).getByRole("button", { name: "Okay" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/plus/outcome-ledger/rating",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ receiptId: "receipt-2", performanceRating: "neutral" }),
        }),
      );
      expect(within(unratedItem as HTMLElement).getByText("Okay")).toBeTruthy();
    });
    expect(within(unratedItem as HTMLElement).queryByRole("button", { name: "Rate this use" })).toBeNull();
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("separates empty and unavailable states from a ready history", () => {
    const { container, rerender } = render(
      <PlusOutcomeHistory
        history={{ status: "empty", items: [], pendingCount: 0 }}
        locale="en"
      />,
    );
    expect(container.querySelector('[data-plus-outcome-history="empty"]')).toBeTruthy();
    expect(container.textContent).toContain("No use recorded in the last 30 days.");

    rerender(
      <PlusOutcomeHistory
        history={{ status: "unavailable", items: [], pendingCount: 0 }}
        locale="en"
      />,
    );
    expect(container.querySelector('[data-plus-outcome-history="unavailable"]')).toBeTruthy();
    expect(container.textContent).toContain("Your use history is unavailable.");

    rerender(
      <PlusOutcomeHistory
        history={{ status: "locked", items: [], pendingCount: 0 }}
        locale="en"
      />,
    );
    expect(container.querySelector('[data-plus-outcome-history="locked"]')).toBeTruthy();
    expect(container.textContent).toContain("Activate Plus to see your personal use history.");
  });

  it("does not render a fake link when localized replay is unavailable", () => {
    const unavailableHistory = {
      ...history,
      items: [
        {
          ...history.items[0],
          href: null,
          linkStatus: "unavailable" as const,
          replayShortId: "meme-1",
        },
      ],
    };
    const { container } = render(
      <PlusOutcomeHistory history={unavailableHistory} locale="en" />,
    );

    expect(container.querySelector('a[href="/en/memes/meme-1-global"]')).toBeNull();
    expect(
      container.querySelector('[data-plus-outcome-history-link-status="unavailable"]'),
    ).toBeTruthy();
    expect(container.querySelector("[data-plus-outcome-history-replay]")).toBeNull();
    expect(container.textContent).toContain("Localized replay unavailable");
  });

  it("uses dedicated Traditional Chinese history copy", () => {
    expect(PLUS_OUTCOME_HISTORY_COPY["zh-tw"].title).toBe("我的使用紀錄");
    expect(PLUS_OUTCOME_HISTORY_COPY["zh-tw"].title).not.toBe(PLUS_OUTCOME_HISTORY_COPY.zh.title);
  });
});
