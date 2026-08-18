// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";

describe("durable growth tracking", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => true),
    });
    window.gtag = vi.fn();
  });

  it("keeps GA and durable ingestion on the canonical growth events", () => {
    track("follow_click", { meme_id: "30000000-0000-4000-8000-000000000003" });

    expect(window.gtag).toHaveBeenCalledWith("event", "follow_click", {
      meme_id: "30000000-0000-4000-8000-000000000003",
    });
    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.any(Blob),
    );
  });

  it("does not persist events outside the durable funnel", () => {
    track("search_submit", { query: "example", result_count: 1 });
    expect(window.gtag).toHaveBeenCalled();
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
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
