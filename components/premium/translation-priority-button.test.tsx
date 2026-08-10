// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const track = vi.hoisted(() => vi.fn());
const premiumState = vi.hoisted(() => ({ value: true }));
const supabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}));

vi.mock("@/lib/hooks/use-premium", () => ({ usePremium: () => premiumState.value }));
vi.mock("@/lib/analytics", () => ({ track }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }));

import {
  TranslationPriorityButton,
  TranslationPriorityStatusMessage,
} from "@/components/premium/translation-priority-button";

function savedQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { meme_id: "meme-1" }, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  premiumState.value = true;
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
  supabase.from.mockReturnValue(savedQuery());
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TranslationPriorityButton", () => {
  it("shows the saved-meme requirement for an unfinished translation", () => {
    const html = renderToStaticMarkup(
      <TranslationPriorityButton
        memeId="meme-1"
        locale="en"
        translationStatus="machine"
        translationIsCurrent={false}
      />,
    );

    expect(html).toContain('data-translation-priority-state="none"');
    expect(html).toContain("Request a reviewed translation for a saved meme");
  });

  it("does not offer a new request for a current reviewed translation", () => {
    const html = renderToStaticMarkup(
      <TranslationPriorityButton
        memeId="meme-1"
        locale="ja"
        translationStatus="reviewed"
        translationIsCurrent
      />,
    );

    expect(html).toContain('data-translation-priority-state="available"');
    expect(html).toContain("この言語の翻訳は最新のレビュー済みです。");
    expect(html).not.toContain("Request priority review");
    expect(html).not.toContain("data-translation-priority-track");
  });

  it.each(["requested", "in_review"] as const)(
    "server-renders the confirmed %s status with a tracking link",
    (status) => {
      const html = renderToStaticMarkup(
        <TranslationPriorityStatusMessage
          status={status}
          copy={{ requested: "Queued", inReview: "In review", track: "Track request" }}
          requestDeskHref="/premium#plus-translation-fulfillment-title"
        />,
      );

      expect(html).toContain(status === "requested" ? "Queued" : "In review");
      expect(html).toContain('data-translation-priority-track="true"');
    },
  );

  it.each(["none", "completed", "dismissed", "already_available", "unavailable"] as const)(
    "does not render a tracking link for %s",
    (status) => {
      const html = renderToStaticMarkup(
        <TranslationPriorityStatusMessage
          status={status}
          copy={{ requested: "Queued", inReview: "In review", track: "Track request" }}
          requestDeskHref="/premium#plus-translation-fulfillment-title"
        />,
      );

      expect(html).not.toContain("data-translation-priority-track");
    },
  );

  it("uses the localized pricing path without a request link for free users", () => {
    premiumState.value = false;
    const html = renderToStaticMarkup(
      <TranslationPriorityButton
        memeId="meme-1"
        locale="en"
        translationStatus="machine"
        translationIsCurrent={false}
      />,
    );

    expect(html).toContain('href="/en/pricing"');
    expect(html).not.toContain("data-translation-priority-track");
  });

  it("keeps signed-out users at the save-required state", async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    render(
      <TranslationPriorityButton
        memeId="meme-1"
        locale="en"
        translationStatus="machine"
        translationIsCurrent={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Save this meme first to request priority review.")).toBeTruthy();
    });
    expect(document.querySelector("[data-translation-priority-track]")).toBeNull();
  });

  it.each(["requested", "in_review"] as const)(
    "links a %s request to the existing Plus fulfillment desk",
    async (status) => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ locked: false, status }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      render(
        <TranslationPriorityButton
          memeId="meme-1"
          locale="en"
          translationStatus="machine"
          translationIsCurrent={false}
        />,
      );

      await waitFor(() => {
        expect(document.querySelector("[data-translation-priority-track]")).toBeTruthy();
      });
      expect(
        document.querySelector<HTMLAnchorElement>("[data-translation-priority-track]")?.getAttribute("href"),
      ).toBe("/premium#plus-translation-fulfillment-title");
    },
  );

  it("shows the tracking handoff immediately after a successful request", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ locked: false, status: "none" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, status: "requested", requestId: "request-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    render(
      <TranslationPriorityButton
        memeId="meme-1"
        locale="ja"
        translationStatus="machine"
        translationIsCurrent={false}
      />,
    );

    const requestButton = await screen.findByRole("button", { name: "優先レビューを依頼" });
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(document.querySelector("[data-translation-priority-track]")).toBeTruthy();
    });
    expect(screen.getByText("Plusでリクエスト状況を確認")).toBeTruthy();
    expect(track).toHaveBeenCalledWith("translation_priority_requested", {
      locale: "ja",
      result: "requested",
    });
  });

  it("fails closed when a successful request response has no valid status", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ locked: false, status: "none" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    render(
      <TranslationPriorityButton
        memeId="meme-1"
        locale="en"
        translationStatus="machine"
        translationIsCurrent={false}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Request priority review" }));

    await waitFor(() => {
      expect(screen.getByText("Could not submit the request. Try again shortly.")).toBeTruthy();
    });
    expect(document.querySelector("[data-translation-priority-track]")).toBeNull();
    expect(document.querySelector('[data-translation-priority-state="unavailable"]')).toBeTruthy();
  });
});
