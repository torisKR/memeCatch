import { describe, expect, it, vi } from "vitest";
import { buildPlusDailySignalEmail, plusDailySignalSince } from "@/lib/plus-daily-signal.server";

vi.mock("server-only", () => ({}));

const candidate = {
  id: "meme-1",
  shortId: "abc12345",
  slug: "hello-world",
  title: "A <safe> title",
  summary: "A useful summary & context.",
  usageNote: "Use it with close friends.",
  caution: "Do not target a real person.",
  shareReady: true,
  trendScore: 88,
  safetyLevel: "green" as const,
  source: "saved_rising" as const,
};

describe("Plus Daily Signal email builder", () => {
  it("uses a shared 36-hour signal window", () => {
    expect(plusDailySignalSince(new Date("2026-08-09T12:00:00.000Z"))).toBe(
      "2026-08-08T00:00:00.000Z",
    );
  });

  it("renders a bounded, localized email with a direct One-Cut link", () => {
    const email = buildPlusDailySignalEmail({
      locale: "en",
      candidates: [candidate, { ...candidate, id: "meme-2", shortId: "def67890" }],
      baseUrl: "https://example.com/",
    });

    expect(email.subject).toContain("Today’s Plus Signal");
    expect(email.text).toContain(
      "https://example.com/premium?focus=meme-1&locale=en&from=daily_signal",
    );
    expect(email.text).not.toContain("/en/memes/abc12345-hello-world");
    expect(email.text).toContain("Prepare today’s One-Cut");
    expect(email.html).toContain("&lt;safe&gt;");
    expect(email.html).not.toContain("A <safe> title");
  });

  it("never includes an empty candidate and keeps the three-item cap", () => {
    const email = buildPlusDailySignalEmail({
      locale: "ja",
      candidates: [
        { ...candidate, title: "", id: "empty" },
        candidate,
        { ...candidate, id: "meme-2" },
        { ...candidate, id: "meme-3" },
        { ...candidate, id: "meme-4" },
      ],
    });

    expect(email.subject).toContain("3件");
    expect(email.text.match(/https:\/\/catchmeme\.com/g)).toHaveLength(3);
  });
});
