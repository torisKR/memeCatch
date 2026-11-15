import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPremiumEntitlement, from, renderMemeCard, imageResponse } = vi.hoisted(() => ({
  getPremiumEntitlement: vi.fn(),
  from: vi.fn(),
  renderMemeCard: vi.fn(() => "rendered-card"),
  imageResponse: vi.fn(),
}));

vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: unknown, options: ResponseInit) {
      imageResponse(element);
      super("png", { status: 200, headers: options.headers });
    }
  },
}));
vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from, rpc: async () => ({ error: null }) }),
  createStaticClient: () => ({ from }),
}));
vi.mock("@/lib/meme-card", () => ({
  CARD_TEMPLATES: {
    classic: { premium: false },
    minimal: { premium: true },
    bold: { premium: true },
  },
  CARD_FORMATS: {
    card: { premium: false, width: 1200, height: 630 },
    story: { premium: true, width: 1080, height: 1920 },
  },
  isCardTemplate: (value: string | null): value is "classic" | "minimal" | "bold" =>
    value === "classic" || value === "minimal" || value === "bold",
  isCardFormat: (value: string | null): value is "card" | "story" =>
    value === "card" || value === "story",
  loadCardFonts: vi.fn().mockResolvedValue(null),
  renderMemeCard,
}));
vi.mock("@/lib/meme-translations", () => ({
  hasRequiredTranslationFields: (value: { title: string; summary: string; description: string; origin: string }) =>
    [value.title, value.summary, value.description, value.origin].every((item) => item.trim().length > 0),
  isTranslationCurrent: (sourceUpdatedAt: string, baseUpdatedAt: string) => sourceUpdatedAt === baseUpdatedAt,
}));
vi.mock("@/lib/i18n-routing", () => ({
  isSeoContentLocale: (value: string | null): value is "en" | "ja" | "zh" | "zh-tw" =>
    value === "en" || value === "ja" || value === "zh" || value === "zh-tw",
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.maybeSingle.mockReturnValue({
    ...result,
    overrideTypes: vi.fn().mockResolvedValue(result),
  });
  return builder;
}

const baseMeme = {
  id: "meme-1",
  title: "한국어 제목",
  summary: "한국어 뜻",
  updated_at: "2026-08-09T00:00:00.000Z",
  safety_level: "green",
  lifecycle_status: "rising",
};

const reviewedTranslation = {
  meme_id: "meme-1",
  locale: "en",
  status: "reviewed",
  title: "Localized title",
  summary: "Localized meaning",
  description: "Localized description",
  origin: "Localized origin",
  source_updated_at: baseMeme.updated_at,
};

function request(url: string) {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
});

describe("meme card export localization", () => {
  it("renders reviewed current content for the requested SEO locale", async () => {
    from
      .mockReturnValueOnce(query({ data: baseMeme, error: null }))
      .mockReturnValueOnce(query({ data: reviewedTranslation, error: null }));

    const response = await GET(
      request("https://catchmeme.com/memes/abc123-title/export?locale=en"),
      { params: Promise.resolve({ key: "abc123-title" }) },
    );

    expect(response.status).toBe(200);
    expect(renderMemeCard).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Localized title", summary: "Localized meaning" }),
      expect.objectContaining({ locale: "en" }),
    );
    expect(imageResponse).toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-language")).toBe("en");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("keeps the canonical Korean source when no SEO locale is requested", async () => {
    from.mockReturnValueOnce(query({ data: baseMeme, error: null }));

    await GET(
      request("https://catchmeme.com/memes/abc123-title/export"),
      { params: Promise.resolve({ key: "abc123-title" }) },
    );

    expect(from).toHaveBeenCalledTimes(1);
    expect(renderMemeCard).toHaveBeenCalledWith(
      expect.objectContaining({ title: "한국어 제목", summary: "한국어 뜻" }),
      expect.objectContaining({ locale: "ko" }),
    );
  });

  it("does not fall back to Korean text for missing or stale localized content", async () => {
    from
      .mockReturnValueOnce(query({ data: baseMeme, error: null }))
      .mockReturnValueOnce(query({
        data: { ...reviewedTranslation, source_updated_at: "2026-08-08T00:00:00.000Z" },
        error: null,
      }));

    const response = await GET(
      request("https://catchmeme.com/memes/abc123-title/export?locale=en"),
      { params: Promise.resolve({ key: "abc123-title" }) },
    );

    expect(response.status).toBe(404);
    expect(renderMemeCard).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale instead of silently exporting Korean text", async () => {
    const response = await GET(
      request("https://catchmeme.com/memes/abc123-title/export?locale=fr"),
      { params: Promise.resolve({ key: "abc123-title" }) },
    );

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
