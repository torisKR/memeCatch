// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";

describe("durable growth tracking", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = "mc_growth_session=; Max-Age=0; Path=/";
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => true),
    });
    window.gtag = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 202 }))));
  });

  it("keeps GA and durable ingestion on the canonical growth events", async () => {
    track("follow_click", {
      meme_id: "30000000-0000-4000-8000-000000000003",
      query: "private beacon payload",
    });

    expect(window.gtag).toHaveBeenCalledWith("event", "follow_click", {
      meme_id: "30000000-0000-4000-8000-000000000003",
    });
    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.any(Blob),
    );

    const payload = vi.mocked(navigator.sendBeacon).mock.calls[0]?.[1];
    expect(payload).toBeInstanceOf(Blob);
    if (!(payload instanceof Blob)) throw new Error("analytics beacon payload must be a Blob");
    const body = await payload.text();
    expect(body).not.toContain("private beacon payload");
    expect(body).not.toContain('"query"');
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain("mc_growth_session=");
  });

  it.each([
    ["search_submit", { query: "private submit", result_count: 1 }, { result_count: 1 }],
    ["search_no_result", { query: "private miss" }, {}],
    ["search_result_click", { query: "private click", to: "/memes/example" }, { to: "/memes/example" }],
    [
      "search_suggest_click",
      { query: "private suggest", meme_short_id: "example" },
      { meme_short_id: "example" },
    ],
  ] as const)("strips raw query from %s without renaming the event", (event, params, safeParams) => {
    track(event, params);

    expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", event, safeParams);
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it("strips raw query before both GA and durable ingestion", () => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => false),
    });

    track("traffic_source", {
      query: "private durable payload",
      source: "threads",
      medium: "social",
    });

    expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", "traffic_source", {
      source: "threads",
      medium: "social",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        body: expect.not.stringContaining("private durable payload"),
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        body: expect.not.stringContaining('"query"'),
      }),
    );
  });

  it("persists privacy-safe acquisition and activation events", () => {
    track("traffic_source", { source: "threads", medium: "social", resolved_by: "utm" });
    track("share_click", { method: "link", to: "/memes/example" });
    track("quiz_start", { mode: "meaning" });
    track("quiz_complete", { mode: "meaning", score: 8 });

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(4);
  });

  it("persists weekly brief open and click events", () => {
    track("plus_weekly_brief_opened", { brief_id: "2026-08-01_2026-08-07", item_count: 3 });
    track("plus_weekly_brief_clicked", {
      brief_id: "2026-08-01_2026-08-07",
      position: 1,
      source: "saved",
    });

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(2);
  });
});
