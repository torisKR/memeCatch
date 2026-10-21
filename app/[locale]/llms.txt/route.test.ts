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

describe("localized llms index policy", () => {
  it.each(["en", "ja", "zh", "zh-tw"])('keeps %s drafts private and feeds reviewed entries only', async (locale) => {
    const response = await GET(new Request(`https://catchmeme.com/${locale}/llms.txt`), {
      params: Promise.resolve({ locale }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-language")).toBeTruthy();
    expect(response.headers.get("cache-control")).toContain("public");
    const body = await response.text();
    expect(body).toMatch(/private|非公開|非公開|私有|私有/iu);
    expect(body).not.toMatch(/visible to readers|読者向けに表示|供读者查看|供讀者查看/iu);
    expect(getLocalizedFeaturedMemesResult).toHaveBeenCalledWith(locale, 15, "approved-only");
  });

  it("rejects unsupported locales", async () => {
    const response = await GET(new Request("https://catchmeme.com/fr/llms.txt"), {
      params: Promise.resolve({ locale: "fr" }),
    });

    expect(response.status).toBe(404);
    expect(getLocalizedFeaturedMemesResult).not.toHaveBeenCalled();
  });

  it("returns 503 when the reviewed corpus cannot be read", async () => {
    getLocalizedFeaturedMemesResult.mockResolvedValue({ items: [], status: "unavailable" });

    const response = await GET(new Request("https://catchmeme.com/en/llms.txt"), {
      params: Promise.resolve({ locale: "en" }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("300");
  });

  it("escapes stored Markdown and HTML syntax in the localized index", async () => {
    getLocalizedFeaturedMemesResult.mockResolvedValue({
      status: "active",
      items: [{
        title: "Title\n# injected ](https://evil.example)",
        summary: "`summary` <script>alert(1)</script>",
        short_id: "abc12345",
        slug: "translated-meme",
      }],
    });

    const body = await (await GET(new Request("https://catchmeme.com/en/llms.txt"), {
      params: Promise.resolve({ locale: "en" }),
    })).text();

    expect(body).not.toContain("\n# injected");
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("](https://evil.example)");
    expect(body).toContain("\\# injected");
  });
});
