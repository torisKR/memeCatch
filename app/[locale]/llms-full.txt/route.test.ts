import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/meme-translations", () => ({
  getLocalizedFeaturedMemes: vi.fn(async () => []),
}));

import { getLocalizedFeaturedMemes } from "@/lib/meme-translations";
import { dynamic as routeDynamic, GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("localized llms-full publication export", () => {
  it("renders on request so a database-less build cannot cache a failure", () => {
    expect(routeDynamic).toBe("force-dynamic");
  });

  it("omits hidden_from_public source rows from the public export", async () => {
    vi.mocked(getLocalizedFeaturedMemes).mockResolvedValue([
      {
        short_id: "abc12345",
        slug: "test-meme",
        title: "Test meme",
        summary: "Summary",
        description: "Meaning",
        origin: "Origin",
        usage_note: "Usage",
        caution: "Caution",
        updated_at: "2026-01-02T00:00:00.000Z",
        original: { title: "원제" },
        translation: { updatedAt: "2026-01-02T00:00:00.000Z" },
        meme_sources: [
          { source_url: "https://namu.wiki/w/hidden", title: "HIDDEN_NAMU", platform: "wiki", hidden_from_public: true },
          { source_url: "https://example.org/visible", title: "Visible source", platform: "web" },
        ],
      },
    ] as never);

    const response = await GET(new Request("https://catchmeme.com/en/llms-full.txt"), {
      params: Promise.resolve({ locale: "en" }),
    });
    const body = await response.text();
    expect(body).toContain("Visible source");
    expect(body).toContain("https://example.org/visible");
    expect(body).not.toContain("HIDDEN_NAMU");
    expect(body).not.toContain("namu.wiki");
  });

});
