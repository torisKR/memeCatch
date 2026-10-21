import { beforeEach, describe, expect, it, vi } from "vitest";

const getLocalizedFeaturedMemesResult = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/meme-translations", () => ({
  getLocalizedFeaturedMemesResult: (...args: unknown[]) => getLocalizedFeaturedMemesResult(...args),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  getLocalizedFeaturedMemesResult.mockResolvedValue({ items: [], status: "coverage-empty" });
});

describe("localized llms-full publication contract", () => {
  it("returns 503 instead of a fake empty corpus when loading fails", async () => {
    getLocalizedFeaturedMemesResult.mockResolvedValue({ items: [], status: "unavailable" });

    const response = await GET(new Request("https://catchmeme.com/en/llms-full.txt"), {
      params: Promise.resolve({ locale: "en" }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("300");
  });

  it("includes only validated reviewed usage examples", async () => {
    getLocalizedFeaturedMemesResult.mockResolvedValue({
      status: "active",
      items: [{
        title: "Translated meme",
        short_id: "abc12345",
        slug: "translated-meme",
        summary: "Summary",
        description: "Description",
        origin: "Origin",
        usage_note: "Usage",
        caution: "Caution",
        usage_examples: [
          { situation: "Friends", text: "A clear example." },
          { situation: "", text: "Invalid example." },
        ],
        original: { title: "원본 밈" },
        meme_sources: [],
        translation: { updatedAt: "2026-10-20T00:00:00.000Z" },
      }],
    });

    const body = await (await GET(new Request("https://catchmeme.com/en/llms-full.txt"), {
      params: Promise.resolve({ locale: "en" }),
    })).text();

    expect(body).toContain("Usage examples");
    expect(body).toContain("Friends: A clear example.");
    expect(body).not.toContain("Invalid example.");
    expect(getLocalizedFeaturedMemesResult).toHaveBeenCalledWith("en", 400, "approved-only");
  });

  it("escapes stored Markdown and HTML control syntax", async () => {
    getLocalizedFeaturedMemesResult.mockResolvedValue({
      status: "active",
      items: [{
        title: "Title\n# injected ](https://evil.example)",
        short_id: "abc12345",
        slug: "translated-meme",
        summary: "`summary` <script>alert(1)</script>",
        description: "Description",
        origin: "Origin",
        usage_note: "Usage",
        caution: "Caution",
        usage_examples: [{ situation: "# context", text: "] (bad)" }],
        original: { title: "원본\n# 제목" },
        meme_sources: [{
          source_url: "https://example.org/source",
          title: "Source ](bad)",
          platform: "Publisher\n# bad",
          creator_name: null,
          captured_at: null,
        }],
        translation: { updatedAt: "2026-10-20T00:00:00.000Z" },
      }],
    });

    const body = await (await GET(new Request("https://catchmeme.com/en/llms-full.txt"), {
      params: Promise.resolve({ locale: "en" }),
    })).text();

    expect(body).not.toContain("\n# injected");
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("](https://evil.example)");
    expect(body).not.toContain("\n# 제목");
    expect(body).toContain("\\# injected");
    expect(body).toContain("원본 \\# 제목");
  });
});
