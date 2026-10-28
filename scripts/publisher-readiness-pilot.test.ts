import { describe, expect, it, vi } from "vitest";
import { buildPublisherPilot, pilotTarget, readPublisherPilot } from "./publisher-readiness-pilot.mts";
import type { PublisherReadinessRow } from "../lib/publisher-readiness";

const row = { id: "one", short_id: "first", slug: "test", title: "테스트", summary: "의미",
  description: "실제 설명", origin: "미확인", moderation_status: "approved", published_at: null,
  updated_at: "2026-10-01T00:00:00Z", safety_level: "yellow", safety_reviewed_at: null,
  house_rights_attested_at: null, meme_sources: [], meme_contents: [],
} satisfies PublisherReadinessRow;

describe("bounded publisher pilot", () => {
  it("keeps absent reviews unknown, excludes pending and counts actual rows without padding", () => {
    const report = buildPublisherPilot([row, row, { ...row, id: "two", moderation_status: "pending" }], "local");
    expect(report.inspected).toBe(1);
    expect(report.coverage).toBe("partial-sample");
    expect(report.items[0].humanReview).toBe("unreviewed");
    expect(report.humanReviewCompleted).toBe(false);
    expect(report.writesPerformed).toBe(false);
  });
  it("never expands its sample beyond 20 or calls that whole-corpus coverage", () => {
    const report = buildPublisherPilot(Array.from({ length: 30 }, (_, i) => ({ ...row, id: String(i) })), "production");
    expect(report.inspected).toBe(20);
    expect(report.coverage).toBe("requested-sample");
    expect(report.accountApprovalVerified).toBe(false);
  });
  it.each(["https://example.com", "http://example.com", "http://user:secret@localhost:54321", "http://localhost:54321/path"])("rejects an unsafe local target %s", (url) => {
    expect(() => pilotTarget(url, "local")).toThrow();
  });
  it("requires an explicit source and a bare trusted target", () => {
    expect(pilotTarget("http://127.0.0.1:54321", "local").hostname).toBe("127.0.0.1");
    expect(() => pilotTarget("http://127.0.0.1:54321", "production")).toThrow();
    expect(() => pilotTarget("https://project.supabase.co.evil.test", "production")).toThrow();
  });
  it("uses two bounded GET reads and never submits a review", async () => {
    const request = vi.fn(async () => Response.json([row]));
    await readPublisherPilot(new URL("http://127.0.0.1:54321"), "sb_publishable_test", request as typeof fetch);
    expect(request).toHaveBeenCalledTimes(2);
    for (const [url, options] of request.mock.calls as unknown as [URL, RequestInit][]) {
      expect(options.method).toBe("GET");
      expect(url.pathname).toBe("/rest/v1/memes");
      expect(url.searchParams.get("limit")).toBe("20");
    }
  });
  it("rejects service credentials and read failures rather than inventing a successful empty pilot", async () => {
    const request = vi.fn();
    await expect(readPublisherPilot(new URL("http://localhost:54321"), "sb_secret_secret", request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await expect(readPublisherPilot(new URL("http://localhost:54321"), "sb_publishable_test", vi.fn(async () => new Response(null, { status: 503 })))).rejects.toThrow("HTTP 503");
  });
});
