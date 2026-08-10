// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlusGlobalActionInbox,
  resolvePlusTodayOutcomeState,
  type PlusGlobalActionInboxCopy,
} from "@/components/premium/plus-global-action-inbox";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";
import { PLUS_NEXT_MOVE_COPY } from "@/lib/plus-next-move-copy";

const copy: PlusGlobalActionInboxCopy = {
  eyebrow: "PLUS ACTION INBOX",
  heading: "Today's meme outcome",
  body: "A short next-step list.",
  contentLanguageLabel: "Content language",
  outcome: {
    ready: (count) => `${count} reviewed memes are ready for today.`,
    prepared: (count) => `${count} cards are ready to use.`,
    complete: (count, currentStreak) => `Today’s outcome complete · ${count} used · ${currentStreak}-day streak`,
  },
  open: "Open meme",
  copyAction: "Copy",
  shareAction: "Share",
  completeAction: "Mark used",
  completing: "Saving…",
  completed: "Marked used",
  actionFailed: "Try again",
  completionUnavailable: "Completion tracking is temporarily unavailable.",
  progress: (completedTodayCount, currentStreak) =>
    `${completedTodayCount} used today · ${currentStreak}-day streak`,
  kindLabels: {
    outcome_replay: "Outcome replay",
    translation_ready: "Translation ready",
    saved_signal: "Saved signal",
    new_reviewed: "Newly reviewed",
  },
  empty: { heading: "Nothing now", body: "Come back later." },
  unavailable: { heading: "Unavailable", body: "Try again." },
  partialUnavailable: (count) => `${count} unavailable sources`,
  creatorPack: {
    title: "Today's Creator Pack",
    body: "Prepare localized captions, safety checks, and share cards.",
    exampleLabel: "What situation is this for?",
    examplePreview: "Reviewed line",
    exampleUnavailable: "No reviewed usage example is available, so no new sentence will be generated.",
    includeMoreLabel: "Include the other ready cards",
    includeMoreDescription: "Choose a reviewed situation for each card and prepare them together.",
    create: "Create Creator Pack",
    channelRequired: "Choose a posting channel first.",
    recommended: (count) => `Recommended from ${count} recent results`,
    preparing: "Preparing cards…",
    shared: "The share sheet is open.",
    shareAgain: "Share prepared cards",
    downloadAgain: "Save card again",
    reusable: (count) => `${count} card${count === 1 ? " is" : "s are"} still ready. Share or save ${count === 1 ? "it" : "them"} again anytime.`,
    fallback: "Caption copied and cards saved.",
    downloaded: "Cards saved. Please copy the caption manually.",
    partial: (succeeded, failed) => `${succeeded} cards ready. ${failed} skipped.`,
    error: "Could not prepare the Creator Pack.",
    empty: "No reviewed actions can become cards right now.",
    ready: (count) => `${count} card${count === 1 ? "" : "s"} ready to use.`,
    complete: (count) => `Mark ${count} card${count === 1 ? "" : "s"} as used`,
    completing: "Recording use…",
    completed: (count) => `Marked ${count} card${count === 1 ? "" : "s"} as used.`,
    partialCompleted: (succeeded, failed) => `Marked ${succeeded} as used. ${failed} remain to retry.`,
    completionError: "Could not record use. The prepared cards remain available to retry.",
  },
};

function creatorPackAction(
  index: number,
  usageExamples?: NonNullable<PlusGlobalActionInboxItem["creatorPackFacts"]>["usageExamples"],
): PlusGlobalActionInboxItem {
  return {
    id: `signal:meme-${index}`,
    memeId: `meme-${index}`,
    shortId: `short${index}`,
    slug: `ready-meme-${index}`,
    title: `Ready meme ${index}`,
    summary: `Reviewed and ready ${index}.`,
    locale: "en",
    href: `/en/memes/short${index}-ready-meme-${index}`,
    shareText: `Ready meme ${index}\n\nReviewed and ready ${index}.\n\n/en/memes/short${index}-ready-meme-${index}`,
    kind: "new_reviewed",
    changedAt: null,
    trendScore: 10 - index,
    creatorPackFacts: {
      title: `Ready meme ${index}`,
      summary: `Reviewed and ready ${index}.`,
      usageNote: null,
      caution: null,
      safetyLevel: "green",
      lifecycleStatus: "active",
      ...(usageExamples ? { usageExamples } : {}),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          completed: true,
          alreadyCompleted: false,
          alreadyRecorded: false,
          receiptId: "receipt-default",
          completedTodayCount: 2,
          currentStreak: 4,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "gtag");
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PlusGlobalActionInbox", () => {
  it("emits the ready, prepared, and receipt funnel events without private fields", async () => {
    const gtag = vi.fn();
    Object.defineProperty(window, "gtag", { configurable: true, value: gtag });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:funnel-card"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            completed: true,
            alreadyRecorded: false,
            receiptId: "receipt-funnel",
            completedTodayCount: 1,
            currentStreak: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(new Blob(["png"]), { status: 200 });
    });

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        entrySource="daily_signal"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    await waitFor(() =>
      expect(gtag).toHaveBeenCalledWith("event", "plus_one_cut_ready", {
        locale: "en",
        count: 1,
        entry_source: "daily_signal",
      }),
    );
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    await screen.findByText("Caption copied and cards saved.");
    expect(gtag).toHaveBeenCalledWith("event", "plus_one_cut_prepared", {
      locale: "en",
      count: 1,
      entry_source: "daily_signal",
    });
    const preparedDraft = vi.mocked(navigator.clipboard.writeText).mock.calls.slice(-1)[0]?.[0] ?? "";
    expect(preparedDraft.indexOf("/en/memes/short0-ready-meme-0")).toBeLessThan(
      preparedDraft.indexOf("Safety: Generally usable"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark 1 card as used" }));
    const form = await screen.findByRole("form", { name: "Completion receipt" });
    fireEvent.change(within(form).getByLabelText("Post URL", { exact: false }), {
      target: { value: "https://example.com/one-cut/funnel" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Complete & save receipt" }));
    await waitFor(() =>
      expect(gtag).toHaveBeenCalledWith("event", "plus_receipt_saved", {
        locale: "en",
        channel: "threads",
        artifact_kind: "creator_pack",
        already_recorded: 0,
        entry_source: "daily_signal",
      }),
    );
    const serializedCalls = JSON.stringify(gtag.mock.calls);
    expect(serializedCalls).not.toContain("receipt-funnel");
  });

  it("requires a posting channel before creating a Creator Pack", async () => {
    const fetchMock = vi.mocked(fetch);
    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(await screen.findByText("Choose a posting channel first.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefills the channel from an outcome replay and marks its entry source", async () => {
    const gtag = vi.fn();
    Object.defineProperty(window, "gtag", { configurable: true, value: gtag });
    const replay = {
      ...creatorPackAction(0),
      kind: "outcome_replay" as const,
      preferredOutcomeChannel: "threads" as const,
    };

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        entrySource="outcome_history"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [replay],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect((screen.getByLabelText("Channel") as HTMLSelectElement).value).toBe("threads");
    await waitFor(() =>
      expect(gtag).toHaveBeenCalledWith("event", "plus_one_cut_ready", {
        locale: "en",
        count: 1,
        entry_source: "outcome_history",
      }),
    );
    expect(screen.getByText("Outcome replay")).toBeTruthy();
  });

  it("uses the selected vertical channel format and pre-fills the receipt channel", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:channel-ready"),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "tiktok" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(await screen.findByText("1 card ready to use.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/memes/short0/export?locale=en&template=minimal&format=story&scale=1",
      { cache: "no-store" },
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark 1 card as used" }));
    const form = screen.getByRole("form", { name: "Completion receipt" });
    expect((within(form).getByLabelText("Channel") as HTMLSelectElement).value).toBe("tiktok");
    click.mockRestore();
  });

  it("starts with a positive recent channel recommendation and preserves a manual choice", () => {
    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
        nextMove={{
          ratings: [
            { memeId: "used-1", completionDate: "2026-08-09", channel: "threads", rating: "hit" },
            { memeId: "used-2", completionDate: "2026-08-08", channel: "threads", rating: "hit" },
            { memeId: "used-3", completionDate: "2026-08-07", channel: "threads", rating: "neutral" },
          ],
          ratingsStatus: "available",
        }}
      />,
    );

    const channel = screen.getByLabelText("Channel") as HTMLSelectElement;
    expect(channel.value).toBe("threads");
    expect(screen.getByText("Recommended from 3 recent results: Threads")).toBeTruthy();

    fireEvent.change(channel, { target: { value: "tiktok" } });
    expect(channel.value).toBe("tiktok");
  });

  it("does not open a channel recommendation when rating data is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ updated: true, receiptId: "followup-1", performanceRating: "hit" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
        outcomeFollowUps={{
          status: "ready",
          pendingCount: 1,
          items: [
            {
              receiptId: "followup-1",
              memeId: "meme-1",
              completionDate: "2026-08-09",
              title: "Previously used",
              channel: "threads",
              locale: "en",
              artifactKind: "creator_pack",
              performanceNote: null,
              performanceRating: null,
            },
          ],
        }}
        nextMove={{ ratings: [], ratingsStatus: "unavailable" }}
        mode="one_cut"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Worked" }));
    await waitFor(() => expect(screen.getByText("Rating saved. It will shape your next recommendation.")).toBeTruthy());
    expect(screen.queryByText(/Recommended from/)).toBeNull();
  });

  it("keeps a manual channel choice when a rating response arrives later", async () => {
    const deferredRating: { resolve: (response: Response) => void } = {
      resolve: () => {},
    };
    const pendingRating = new Promise<Response>((resolve) => {
      deferredRating.resolve = resolve;
    });
    vi.mocked(fetch).mockImplementationOnce(() => pendingRating);

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
        outcomeFollowUps={{
          status: "ready",
          pendingCount: 1,
          items: [
            {
              receiptId: "followup-1",
              memeId: "meme-1",
              completionDate: "2026-08-09",
              title: "Previously used",
              channel: "threads",
              locale: "en",
              artifactKind: "creator_pack",
              performanceNote: null,
              performanceRating: null,
            },
          ],
        }}
        nextMove={{
          ratings: [
            { memeId: "used-1", completionDate: "2026-08-08", channel: "threads", rating: "hit" },
            { memeId: "used-2", completionDate: "2026-08-07", channel: "threads", rating: "hit" },
            { memeId: "used-3", completionDate: "2026-08-06", channel: "threads", rating: "neutral" },
          ],
          ratingsStatus: "available",
        }}
        mode="one_cut"
      />,
    );

    const channel = screen.getByLabelText("Channel") as HTMLSelectElement;
    fireEvent.click(screen.getByRole("button", { name: "Worked" }));
    fireEvent.change(channel, { target: { value: "tiktok" } });
    deferredRating.resolve(
      new Response(
        JSON.stringify({ updated: true, receiptId: "followup-1", performanceRating: "hit" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await waitFor(() => expect(screen.getByText("Rating saved. It will shape your next recommendation.")).toBeTruthy());
    expect(channel.value).toBe("tiktok");
  });

  it("shows a completed today outcome when all available actions were already used", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "empty",
          items: [],
          unavailableLanes: [],
          completion: {
            status: "available",
            completedMemeIds: ["meme-1"],
            completedTodayCount: 2,
            currentStreak: 4,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-today-outcome="complete"');
    expect(html).toContain("Today’s outcome complete · 2 used · 4-day streak");
    expect(html).not.toContain("Nothing now");
  });

  it("resolves prepared, ready, empty, and unavailable outcome states", () => {
    expect(
      resolvePlusTodayOutcomeState({
        itemCount: 2,
        preparedCount: 1,
        completedTodayCount: 0,
        resultStatus: "active",
      }),
    ).toBe("prepared");
    expect(
      resolvePlusTodayOutcomeState({
        itemCount: 2,
        preparedCount: 0,
        completedTodayCount: 0,
        resultStatus: "active",
      }),
    ).toBe("ready");
    expect(
      resolvePlusTodayOutcomeState({
        itemCount: 0,
        preparedCount: 0,
        completedTodayCount: 0,
        resultStatus: "empty",
      }),
    ).toBe("empty");
    expect(
      resolvePlusTodayOutcomeState({
        itemCount: 0,
        preparedCount: 0,
        completedTodayCount: 4,
        resultStatus: "unavailable",
      }),
    ).toBe("unavailable");
  });

  it("renders a safe exact-locale action link and partial state", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: ["saved_signal"],
          items: [
            {
              id: "translation:request-1",
              memeId: "meme-1",
              shortId: "abc123",
              title: "Ready meme",
              summary: "Reviewed and ready.",
              locale: "ja",
              href: "/ja/memes/abc123-ready",
              shareText: "Ready meme\n\nReviewed and ready.\n\n/ja/memes/abc123-ready",
              kind: "translation_ready",
              changedAt: "2026-08-09T04:00:00.000Z",
              trendScore: 0,
            },
          ],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 1,
            currentStreak: 3,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-global-action-inbox="active"');
    expect(html).toContain('data-action-kind="translation_ready"');
    expect(html).toContain("Translation ready · 日本語");
    expect(html).toContain('data-action-completion-status="available"');
    expect(html).toContain('href="/ja/memes/abc123-ready"');
    expect(html).toContain("Copy");
    expect(html).toContain("Create Creator Pack");
    expect(html).toContain('data-plus-creator-pack="idle"');
    expect(html).toContain("1 used today · 3-day streak");
    expect(html).toContain("1 unavailable sources");
    const recommendationIndex = html.indexOf('data-action-kind="translation_ready"');
    const preparationIndex = html.indexOf("Create Creator Pack");
    expect(preparationIndex).toBeGreaterThanOrEqual(0);
    expect(recommendationIndex).toBeGreaterThan(preparationIndex);
  });

  it("discloses the content language for a fallback One-Cut card", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        displayLocale="ja"
        result={{
          status: "active",
          items: [creatorPackAction(0)],
          unavailableLanes: [],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(html).toContain("Content language: English");
  });

  it("renders the private seven-day outcome summary without exposing receipt details", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        copy={copy}
        outcomeSummary={{
          status: "ready",
          fromDate: "2026-08-03",
          toDate: "2026-08-09",
          totalReceipts: 2,
          totalCompletions: 3,
          pendingReceiptCount: 1,
          awaitingPerformanceCount: 2,
          byChannel: [{ key: "threads", count: 2 }],
          byLocale: [{ key: "en", count: 2 }],
          byArtifactKind: [{ key: "creator_pack", count: 2 }],
        }}
        result={{
          status: "empty",
          items: [],
          unavailableLanes: [],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-outcome-summary="ready"');
    expect(html).toContain('<details data-plus-outcome-summary="ready" open=""');
    expect(html).toContain("See what you actually used, grouped by channel and language.");
    expect(html).toContain("2 uses");
    expect(html).toContain("Threads");
    expect(html).toContain("English");
    expect(html).toContain("1 receipt pending");
    expect(html).not.toContain("https://private.example");
    expect(html).not.toContain("private note");
  });

  it("shares reviewed cards together through the native share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    vi.mocked(fetch).mockImplementation(async () => new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [
            {
              id: "signal:meme-1",
              memeId: "meme-1",
              shortId: "abc123",
              slug: "ready-meme",
              title: "Ready meme",
              summary: "Reviewed and ready.",
              locale: "en",
              href: "/en/memes/abc123-ready-meme",
              shareText: "Ready meme\n\nReviewed and ready.\n\n/en/memes/abc123-ready-meme",
              kind: "new_reviewed",
              changedAt: null,
              trendScore: 10,
              creatorPackFacts: {
                title: "Ready meme",
                summary: "Reviewed and ready.",
                usageNote: "Use it with the right audience.",
                caution: null,
                safetyLevel: "green",
                lifecycleStatus: "active",
              },
            },
          ],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Today's Creator Pack",
        text: expect.stringContaining("Ready meme"),
        files: expect.arrayContaining([expect.any(File)]),
      }),
    );
    expect(await screen.findByText("The share sheet is open.")).toBeTruthy();
  });

  it("reuses prepared cards for a second native share without refetching", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Share prepared cards" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redownloads a prepared card from the retained blob without a new export", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("clipboard blocked")) },
    });

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    await screen.findByText("Cards saved. Please copy the caption manually.");

    fireEvent.click(screen.getByRole("button", { name: "Save card again: Ready meme 0" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });

  it("keeps prepared cards reusable after the receipt is saved", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            completed: true,
            alreadyRecorded: false,
            receiptId: "receipt-reusable",
            completedTodayCount: 1,
            currentStreak: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(new Blob(["png"]), { status: 200 });
    });

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    await screen.findByRole("button", { name: "Mark 1 card as used" });
    fireEvent.click(screen.getByRole("button", { name: "Mark 1 card as used" }));
    const form = await screen.findByRole("form", { name: "Completion receipt" });
    fireEvent.change(within(form).getByLabelText("Post URL", { exact: false }), {
      target: { value: "https://example.com/one-cut/reusable" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Complete & save receipt" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Completion receipt" })).toBeNull());
    expect(screen.getByText("1 card is still ready. Share or save it again anytime.")).toBeTruthy();
    expect(screen.queryByText("Completion tracking is temporarily unavailable.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark 0 cards as used" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Share prepared cards" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Save card again: Ready meme 0" })).toBeTruthy();
  });

  it("prevents concurrent re-share attempts", async () => {
    let releaseSecondShare: () => void = () => {};
    const share = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          releaseSecondShare = resolve;
        }),
      );
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const reuseButton = screen.getByRole("button", { name: "Share prepared cards" });
    fireEvent.click(reuseButton);
    await waitFor(() => expect((reuseButton as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(reuseButton);
    expect(share).toHaveBeenCalledTimes(2);
    releaseSecondShare();
    await waitFor(() => expect((reuseButton as HTMLButtonElement).disabled).toBe(false));
  });

  it("keeps the prepared pack available when the native share sheet is cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("1 card ready to use.").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Mark 1 card as used" })).toBeTruthy();
    expect(document.querySelector('[data-plus-creator-pack="idle"]')).toBeTruthy();
  });

  it("keeps a partial pack visible and falls back to copied text plus downloads", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes("short0")) return new Response(new Blob(["png"]), { status: 200 });
      throw new Error("export failed");
    });

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [
            {
              id: "signal:meme-0",
              memeId: "meme-0",
              shortId: "short0",
              slug: "ready-meme-0",
              title: "Ready meme 0",
              summary: "Reviewed and ready 0.",
              locale: "en",
              href: "/en/memes/short0-ready-meme-0",
              shareText: "Ready meme 0\n\nReviewed and ready 0.\n\n/en/memes/short0-ready-meme-0",
              kind: "new_reviewed",
              changedAt: null,
              trendScore: 10,
              creatorPackFacts: {
                title: "Ready meme 0",
                summary: "Reviewed and ready 0.",
                usageNote: null,
                caution: null,
                safetyLevel: "green",
                lifecycleStatus: "active",
              },
            },
            {
              id: "signal:meme-1",
              memeId: "meme-1",
              shortId: "short1",
              slug: "ready-meme-1",
              title: "Ready meme 1",
              summary: "Reviewed and ready 1.",
              locale: "en",
              href: "/en/memes/short1-ready-meme-1",
              shareText: "Ready meme 1\n\nReviewed and ready 1.\n\n/en/memes/short1-ready-meme-1",
              kind: "new_reviewed",
              changedAt: null,
              trendScore: 9,
              creatorPackFacts: {
                title: "Ready meme 1",
                summary: "Reviewed and ready 1.",
                usageNote: null,
                caution: null,
                safetyLevel: "green",
                lifecycleStatus: "active",
              },
            },
          ],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(await screen.findByText("1 cards ready. 1 skipped.")).toBeTruthy();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Ready meme 0"));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("keeps the prepared pack available when clipboard fallback fails", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    fetchMock.mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(await screen.findByText("Cards saved. Please copy the caption manually.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-plus-creator-pack="downloaded"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark 1 card as used" })).toBeTruthy();
    click.mockRestore();
  });

  it("does not record Creator Pack use until the receipt is confirmed", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            completed: true,
            alreadyRecorded: false,
            receiptId: "receipt-0",
            completedTodayCount: 1,
            currentStreak: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(new Blob(["png"]), { status: 200 });
    });

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(await screen.findByText("1 card ready to use.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Mark 1 card as used" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark 1 card as used" }));

    const form = screen.getByRole("form", { name: "Completion receipt" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(within(form).getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.change(within(form).getByLabelText("Performance note", { exact: false }), {
      target: { value: "12 saves" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Complete & save receipt" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Completion receipt" })).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plus/action-inbox/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          memeId: "meme-0",
          locale: "en",
          channel: "threads",
          artifactKind: "creator_pack",
          mode: "bulk",
          resultUrl: null,
          performanceNote: "12 saves",
          privateNote: null,
        }),
      }),
    );
    expect(screen.getByText("Marked used")).toBeTruthy();
    click.mockRestore();
  });

  it("one-cut mode exposes one reviewed card with an image preview before completion", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:one-cut-preview"),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        outcomeSummary={{
          status: "ready",
          fromDate: "2026-08-03",
          toDate: "2026-08-09",
          totalReceipts: 2,
          totalCompletions: 2,
          pendingReceiptCount: 0,
          awaitingPerformanceCount: 0,
          byChannel: [],
          byLocale: [],
          byArtifactKind: [],
        }}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0), creatorPackAction(1)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(document.querySelector('[data-plus-action-mode="one_cut"]')).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Ready meme 1")).toBeNull();
    expect(document.querySelector('[data-plus-outcome-summary]')).toBeNull();

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(
      (await screen.findByRole("img", { name: "Ready meme 0" })).getAttribute("src"),
    ).toBe("blob:one-cut-preview");
    expect(document.querySelector("[data-plus-creator-pack-preview]")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("form", { name: "Completion receipt" })).toBeNull();
    click.mockRestore();
  });

  it("keeps multi-item scenario choices and prepared share text isolated per meme", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:multi-pack"),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(fetch).mockImplementation(
      async () => new Response(new Blob(["png"]), { status: 200 }),
    );

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [
            creatorPackAction(0, [
              { situation: "First default", text: "First default line." },
              { situation: "First selected", text: "First selected line." },
            ]),
            creatorPackAction(1, [
              { situation: "Second default", text: "Second default line." },
              { situation: "Second selected", text: "Second selected line." },
            ]),
          ],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox"));
    const firstExample = screen.getByLabelText("Ready meme 0 · What situation is this for?");
    const secondExample = screen.getByLabelText("Ready meme 1 · What situation is this for?");
    expect((firstExample as HTMLSelectElement).value).toBe("0");
    expect((secondExample as HTMLSelectElement).value).toBe("0");

    fireEvent.change(firstExample, { target: { value: "1" } });
    expect((firstExample as HTMLSelectElement).value).toBe("1");
    expect((secondExample as HTMLSelectElement).value).toBe("0");
    expect(screen.getByText("Reviewed line: First selected line.")).toBeTruthy();
    expect(screen.getByText("Reviewed line: Second default line.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    expect(await screen.findByText("2 cards ready to use.")).toBeTruthy();
    const shareText = vi.mocked(navigator.clipboard.writeText).mock.lastCall?.[0] ?? "";
    expect(shareText).toContain("First selected line.");
    expect(shareText).toContain("Second default line.");
    expect(shareText).not.toContain("First default line.");
    expect(shareText).not.toContain("Second selected line.");
  });

  it("shows the no-example state for a multi-pack item without generating copy", () => {
    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0), creatorPackAction(1, undefined)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(screen.getByText("Ready meme 0 · What situation is this for?")).toBeTruthy();
    expect(screen.getAllByText(copy.creatorPack.exampleUnavailable)).toHaveLength(2);
  });

  it("lets one-cut choose a reviewed situation line and shows it in the prepared pack", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:one-cut-example"),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [
            creatorPackAction(0, [
              { situation: "Team chat", text: "First reviewed line." },
              { situation: "Deadline changed", text: "/shrug" },
            ]),
          ],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("What situation is this for?"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));

    await screen.findByRole("img", { name: "Ready meme 0" });
    expect(document.querySelector("[data-plus-creator-pack-preview]")?.textContent).toContain("/shrug");
    expect(screen.queryByText(/First reviewed line\./)).toBeNull();
    expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenLastCalledWith(
      expect.stringContaining("\n/shrug\n\n"),
    );
  });

  it("shows the one-cut recommendation before the preparation CTA", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    const recommendationIndex = html.indexOf('data-action-kind="new_reviewed"');
    const preparationIndex = html.indexOf("Create Creator Pack");
    expect(recommendationIndex).toBeGreaterThanOrEqual(0);
    expect(preparationIndex).toBeGreaterThan(recommendationIndex);
  });

  it("keeps one-cut Next Move hidden until a rating exists", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        nextMove={{ ratings: [], ratingsStatus: "available" }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(html).not.toContain("data-plus-next-move");
  });

  it("activates an eligible Next Move candidate as the first One-Cut card", async () => {
    const first = creatorPackAction(0);
    const second = creatorPackAction(1);

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        nextMove={{
          items: [first, second],
          ratings: [
            {
              memeId: first.memeId,
              completionDate: "2026-08-09",
              channel: "threads",
              rating: "miss",
            },
          ],
          ratingsStatus: "available",
        }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [first, second],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    const actionCards = () => Array.from(document.querySelectorAll("[data-action-kind]"));
    expect(actionCards()[0]?.textContent).toContain("Ready meme 0");
    fireEvent.click(screen.getByRole("button", { name: "Use this for One-Cut: Ready meme 1" }));

    await waitFor(() => {
      expect(actionCards()[0]?.textContent).toContain("Ready meme 1");
    });
    expect(screen.getByText("Next Move is now your first One-Cut card.")).toBeTruthy();
  });

  it("uses a saved ready-now candidate when the Action Inbox is empty", () => {
    const savedCandidate = {
      ...creatorPackAction(0),
      kind: "saved_signal" as const,
      href: "/en/memes/short0-ready-meme-0#meme-use-kit-title",
    };
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        nextMove={{ items: [savedCandidate], ratings: [], ratingsStatus: "available" }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "empty",
          unavailableLanes: [],
          items: [],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 1,
            currentStreak: 2,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-next-move="ready"');
    expect(html).toContain("A saved meme worth putting back to work");
    expect(html).toContain("#meme-use-kit-title");
  });

  it("does not reuse a saved candidate that was already completed", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        nextMove={{
          items: [{ ...creatorPackAction(0), kind: "saved_signal" as const }],
          ratings: [],
          ratingsStatus: "available",
        }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "empty",
          unavailableLanes: [],
          items: [],
          completion: {
            status: "available",
            completedMemeIds: ["meme-0"],
            completedTodayCount: 1,
            currentStreak: 2,
          },
        }}
      />,
    );

    expect(html).not.toContain("data-plus-next-move");
  });

  it("shows an existing one-cut Next Move after the outcome follow-up", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        outcomeFollowUps={{
          status: "ready",
          pendingCount: 1,
          items: [
            {
              receiptId: "receipt-follow-up",
              memeId: "meme-0",
              completionDate: "2026-08-09",
              title: "Ready meme 0",
              channel: "threads",
              locale: "en",
              artifactKind: "caption",
              performanceNote: null,
              performanceRating: "hit",
            },
          ],
        }}
        nextMove={{
          ratings: [{ memeId: "meme-0", completionDate: "2026-08-09", channel: "threads", rating: "hit" }],
          ratingsStatus: "available",
        }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-next-move="ready"');
    expect(html.indexOf('data-plus-next-move="ready"')).toBeGreaterThan(
      html.indexOf('data-plus-one-cut-follow-up="true"'),
    );
  });

  it("recomputes one-cut Next Move after a rating is saved", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          updated: true,
          receiptId: "receipt-follow-up",
          performanceRating: "hit",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        outcomeFollowUps={{
          status: "ready",
          pendingCount: 1,
          items: [
            {
              receiptId: "receipt-follow-up",
              memeId: "meme-0",
              completionDate: "2026-08-09",
              title: "Ready meme 0",
              channel: "threads",
              locale: "en",
              artifactKind: "caption",
              performanceNote: null,
              performanceRating: null,
            },
          ],
        }}
        nextMove={{ ratings: [], ratingsStatus: "available" }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(document.querySelector("[data-plus-next-move]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Worked" }));

    await waitFor(() => {
      expect(document.querySelector('[data-plus-next-move="ready"]')).toBeTruthy();
    });
    expect(screen.getByText("Similar to a direction that worked for you")).toBeTruthy();
    expect(screen.getByText("Rating saved. It will shape your next recommendation.")).toBeTruthy();
  });

  it("keeps one-cut Next Move hidden when rating save fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ updated: false }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        outcomeFollowUps={{
          status: "ready",
          pendingCount: 1,
          items: [
            {
              receiptId: "receipt-follow-up",
              memeId: "meme-0",
              completionDate: "2026-08-09",
              title: "Ready meme 0",
              channel: "threads",
              locale: "en",
              artifactKind: "caption",
              performanceNote: null,
              performanceRating: null,
            },
          ],
        }}
        nextMove={{ ratings: [], ratingsStatus: "available" }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Worked" }));

    await waitFor(() => {
      expect(screen.getByText("Could not save the rating. Try again.")).toBeTruthy();
    });
    expect(document.querySelector("[data-plus-next-move]")).toBeNull();
  });

  it("keeps full inbox Next Move visible before any rating", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        copy={copy}
        nextMove={{ ratings: [], ratingsStatus: "available" }}
        nextMoveCopy={PLUS_NEXT_MOVE_COPY.en}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-next-move="ready"');
  });

  it("keeps the one-cut receipt unavailable until Creator Pack preparation succeeds", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new Blob(["png"]), { status: 200 }));
    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Mark used" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    expect(await screen.findByRole("button", { name: "Mark 1 card as used" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark 1 card as used" }));
    const form = await screen.findByRole("form", { name: "Completion receipt" });
    const preparation = document.querySelector("[data-plus-creator-pack]");

    expect(preparation).toBeTruthy();
    expect(form.closest("[data-action-kind]")).toBeNull();
    if (!preparation) throw new Error("Creator Pack preparation controls are missing");
    expect(preparation.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("exposes pending outcome follow-up controls in the one-cut dashboard", () => {
    const html = renderToStaticMarkup(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        outcomeFollowUps={{
          status: "ready",
          pendingCount: 1,
          items: [
            {
              receiptId: "receipt-follow-up",
              memeId: "meme-0",
              completionDate: "2026-08-09",
              title: "Ready meme 0",
              channel: "threads",
              locale: "en",
              artifactKind: "caption",
              performanceNote: null,
              performanceRating: null,
            },
          ],
        }}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(html).toContain('data-plus-one-cut-follow-up="true"');
    expect(html).toContain('data-plus-outcome-follow-up-item="pending"');
    expect(html).toContain("Add result");
    expect(html).toContain("Worked");
    expect(html.indexOf('data-plus-one-cut-follow-up="true"')).toBeGreaterThan(
      html.indexOf('data-plus-creator-pack="idle"'),
    );
  });

  it("keeps the one-cut follow-up hidden for non-ready states", () => {
    for (const status of ["locked", "empty", "unavailable"] as const) {
      const html = renderToStaticMarkup(
        <PlusGlobalActionInbox
          mode="one_cut"
          copy={copy}
          outcomeFollowUps={{ status, pendingCount: 0, items: [] }}
          result={{
            status: "active",
            unavailableLanes: [],
            items: [creatorPackAction(0)],
            completion: {
              status: "available",
              completedMemeIds: [],
              completedTodayCount: 0,
              currentStreak: 0,
            },
          }}
        />,
      );

      expect(html).not.toContain("data-plus-one-cut-follow-up");
    }
  });

  it("one-cut completion keeps the prepared receipt to channel and explicit artifact only", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            completed: true,
            alreadyRecorded: false,
            receiptId: "receipt-one-cut",
            completedTodayCount: 1,
            currentStreak: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(new Blob(["png"]), { status: 200 });
    });
    render(
      <PlusGlobalActionInbox
        mode="one_cut"
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Mark used" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "instagram" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    expect(await screen.findByRole("button", { name: "Mark 1 card as used" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark 1 card as used" }));
    const form = screen.getByRole("form", { name: "Completion receipt" });

    expect(form.getAttribute("data-plus-outcome-receipt-mode")).toBe("compact");
    expect(form.querySelector("#plus-outcome-url-meme-0")).toBeTruthy();
    expect(form.querySelector("#plus-outcome-performance-meme-0")).toBeNull();
    expect(form.querySelector("#plus-outcome-note-meme-0")).toBeNull();
    expect(within(form).getByLabelText("Channel")).toHaveProperty("value", "instagram");
    fireEvent.change(within(form).getByLabelText("Post URL", { exact: false }), {
      target: { value: "https://example.com/one-cut/meme-0" },
    });

    fireEvent.change(within(form).getByLabelText("Channel"), {
      target: { value: "threads" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Complete & save receipt" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Completion receipt" })).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plus/action-inbox/complete",
      expect.objectContaining({
        body: JSON.stringify({
          memeId: "meme-0",
          locale: "en",
          channel: "threads",
          artifactKind: "creator_pack",
          mode: "one_cut",
          resultUrl: "https://example.com/one-cut/meme-0",
          performanceNote: null,
          privateNote: null,
        }),
      }),
    );
  });

  it("keeps failed receipt items available after a partial completion", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:creator-card"),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    let completionCalls = 0;
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        completionCalls += 1;
        if (completionCalls === 1) {
          return new Response(
            JSON.stringify({
              completed: true,
              alreadyRecorded: false,
              receiptId: "receipt-0",
              completedTodayCount: 1,
              currentStreak: 1,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "completion_failed" }), { status: 500 });
      }
      return new Response(new Blob(["png"]), { status: 200 });
    });

    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [creatorPackAction(0), creatorPackAction(1)],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Creator Pack" }));
    expect(await screen.findByText("2 cards ready to use.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark 2 cards as used" }));

    const firstForm = screen.getByRole("form", { name: "Completion receipt" });
    fireEvent.change(within(firstForm).getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.change(within(firstForm).getByLabelText("Post URL", { exact: false }), {
      target: { value: "https://example.com/one-cut/first" },
    });
    fireEvent.click(within(firstForm).getByRole("button", { name: "Complete & save receipt" }));

    await waitFor(() =>
      expect(screen.getByText("Marked 1 as used. 1 remain to retry.")).toBeTruthy(),
    );
    expect(screen.queryByRole("form", { name: "Completion receipt" })).toBeTruthy();
    expect(screen.queryByText("Ready meme 0")).toBeNull();
    expect(screen.getAllByText("Ready meme 1").length).toBeGreaterThan(0);

    const secondForm = screen.getByRole("form", { name: "Completion receipt" });
    fireEvent.change(within(secondForm).getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.change(within(secondForm).getByLabelText("Post URL", { exact: false }), {
      target: { value: "https://example.com/one-cut/second" },
    });
    fireEvent.change(within(secondForm).getByLabelText("Private note", { exact: false }), {
      target: { value: "retry this" },
    });
    fireEvent.click(within(secondForm).getByRole("button", { name: "Complete & save receipt" }));

    await waitFor(() => expect(screen.getByText("Could not save it. Your entries are still here to retry.")).toBeTruthy());
    expect(screen.getByRole("form", { name: "Completion receipt" })).toBeTruthy();
    expect(
      within(screen.getByRole("form", { name: "Completion receipt" })).getByLabelText("Private note", {
        exact: false,
      }),
    ).toHaveProperty("value", "retry this");
    expect(completionCalls).toBe(2);
    click.mockRestore();
  });

  it("distinguishes empty from unavailable", () => {
    const empty = renderToStaticMarkup(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "empty",
          items: [],
          unavailableLanes: [],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );
    const unavailable = renderToStaticMarkup(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "unavailable",
          items: [],
          unavailableLanes: ["new_reviewed"],
          completion: {
            status: "unavailable",
            completedMemeIds: [],
            completedTodayCount: 0,
            currentStreak: 0,
          },
        }}
      />,
    );

    expect(empty).toContain('data-plus-global-action-inbox="empty"');
    expect(empty).toContain(copy.empty.heading);
    expect(empty).not.toContain("Create Creator Pack");
    expect(unavailable).toContain('data-plus-global-action-inbox="unavailable"');
    expect(unavailable).toContain(copy.unavailable.heading);
    expect(unavailable).not.toContain("Create Creator Pack");
  });

  it("removes a completed card and refreshes the progress summary", async () => {
    render(
      <PlusGlobalActionInbox
        copy={copy}
        result={{
          status: "active",
          unavailableLanes: [],
          items: [
            {
              id: "signal:meme-1",
              memeId: "meme-1",
              shortId: "abc123",
              title: "Ready meme",
              summary: "Reviewed and ready.",
              locale: "en",
              href: "/en/memes/abc123-ready",
              shareText: "Ready meme\n\nReviewed and ready.\n\n/en/memes/abc123-ready",
              kind: "new_reviewed",
              changedAt: null,
              trendScore: 10,
            },
          ],
          completion: {
            status: "available",
            completedMemeIds: [],
            completedTodayCount: 1,
            currentStreak: 3,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark used" }));
    const form = screen.getByRole("form", { name: "Completion receipt" });
    fireEvent.change(within(form).getByLabelText("Channel"), { target: { value: "threads" } });
    fireEvent.click(within(form).getByRole("button", { name: "Complete & save receipt" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Completion receipt" })).toBeNull());
    expect(screen.queryByText("Ready meme")).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/plus/action-inbox/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          memeId: "meme-1",
          locale: "en",
          channel: "threads",
          artifactKind: "caption",
          mode: "bulk",
          resultUrl: null,
          performanceNote: null,
          privateNote: null,
        }),
      }),
    );
    expect(screen.getByText("Marked used")).toBeTruthy();
    expect(screen.getByText("2 used today · 4-day streak")).toBeTruthy();
  });
});
