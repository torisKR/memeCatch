// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlusOutcomeFollowUp } from "@/components/premium/plus-outcome-follow-up";
import { PLUS_OUTCOME_COPY } from "@/lib/plus-outcome-copy";

const receiptId = "receipt-1";
const items = [
  {
    receiptId,
    memeId: "meme-1",
    completionDate: "2026-08-09",
    title: "Ready meme",
    channel: "threads" as const,
    locale: "en" as const,
    artifactKind: "creator_pack" as const,
    performanceNote: null,
    performanceRating: null,
  },
  {
    receiptId: "receipt-2",
    memeId: "meme-2",
    completionDate: "2026-08-08",
    title: "Already reviewed",
    channel: "instagram" as const,
    locale: "ja" as const,
    artifactKind: "caption" as const,
    performanceNote: "좋은 반응",
    performanceRating: null,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          updated: true,
          receiptId,
          performanceNote: "저장 12회",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PlusOutcomeFollowUp", () => {
  it("shows recent metadata without private URL or note fields", () => {
    const html = render(
      <PlusOutcomeFollowUp
        items={items}
        copy={PLUS_OUTCOME_COPY.en}
        onSaved={vi.fn()}
      />,
    );

    expect(html.container.textContent).toContain("Ready meme");
    expect(html.container.textContent).toContain("Threads");
    expect(html.container.textContent).toContain("English");
    expect(html.container.textContent).toContain("좋은 반응");
    expect(html.container.textContent).not.toContain("private note");
    expect(html.container.textContent).not.toContain("https://");
  });

  it("keeps an empty input local and updates the pending row after success", async () => {
    const onSaved = vi.fn();
    render(<PlusOutcomeFollowUp items={items} copy={PLUS_OUTCOME_COPY.en} onSaved={onSaved} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Add result" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Add a short performance note first.",
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "저장 12회" } });
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(receiptId));
    expect(screen.getByText("Performance saved.")).toBeTruthy();
    expect(screen.getByText("저장 12회")).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/plus/outcome-ledger/performance",
      expect.objectContaining({
        body: JSON.stringify({ receiptId, performanceNote: "저장 12회" }),
      }),
    );
  });

  it("stores a one-time rating and reports it to the recommendation loop", async () => {
    const onRated = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          updated: true,
          receiptId,
          performanceRating: "hit",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <PlusOutcomeFollowUp
        items={items}
        copy={PLUS_OUTCOME_COPY.en}
        onSaved={vi.fn()}
        onRated={onRated}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Worked" })[0]);

    await waitFor(() => expect(onRated).toHaveBeenCalledWith(
      { receiptId, memeId: "meme-1", completionDate: "2026-08-09", channel: "threads" },
      "hit",
    ));
    expect(screen.getByText("Rating saved. It will shape your next recommendation.")).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/plus/outcome-ledger/rating",
      expect.objectContaining({
        body: JSON.stringify({ receiptId, performanceRating: "hit" }),
      }),
    );
  });
});
