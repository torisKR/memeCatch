import { beforeEach, describe, expect, it, vi } from "vitest";

const getLocalizedFeaturedMemes = vi.fn();

vi.mock("@/lib/meme-translations", () => ({
  getLocalizedFeaturedMemes: (...args: unknown[]) => getLocalizedFeaturedMemes(...args),
}));

import { GET, dynamic as routeDynamic } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  getLocalizedFeaturedMemes.mockResolvedValue([]);
});

describe("localized llms index policy", () => {
  it("renders on request so a database-less build cannot cache a failure", () => {
    expect(routeDynamic).toBe("force-dynamic");
  });

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
    expect(getLocalizedFeaturedMemes).toHaveBeenCalledWith(locale, 15);
  });

  it("rejects unsupported locales", async () => {
    const response = await GET(new Request("https://catchmeme.com/fr/llms.txt"), {
      params: Promise.resolve({ locale: "fr" }),
    });

    expect(response.status).toBe(404);
    expect(getLocalizedFeaturedMemes).not.toHaveBeenCalled();
  });
});
