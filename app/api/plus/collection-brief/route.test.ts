import { beforeEach, describe, expect, it, vi } from "vitest";

const getPremiumEntitlement = vi.fn();
const from = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from }),
}));

import { POST } from "./route";

function request(body: unknown, contentType = "application/json") {
  return new Request("https://catchmeme.com/api/plus/collection-brief", {
    method: "POST",
    headers: { "content-type": contentType },
    body: contentType.includes("json") ? JSON.stringify(body) : String(body),
  });
}

function savedQuery(rows: unknown[], count = rows.length, error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue({ data: rows, count, error });
  return builder;
}

function translationQuery(rows: unknown[], error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockResolvedValue({ data: rows, error });
  return builder;
}

const savedRow = {
  created_at: "2026-08-09T00:00:00.000Z",
  collection: "Launch ideas",
  note: "Use in the launch post",
  memes: {
    id: "meme-1",
    short_id: "abc123",
    slug: "signal",
    title: "Signal meme",
    summary: "A short meaning",
    description: "A documented entry",
    origin: "A broadcast clip",
    usage_note: "Use with close friends",
    caution: "Do not target a real person",
    safety_level: "yellow",
    lifecycle_status: "rising",
    trend_score: 90,
    updated_at: "2026-08-08T00:00:00.000Z",
    moderation_status: "approved",
  },
};

const reviewedTranslation = {
  meme_id: "meme-1",
  locale: "en",
  status: "reviewed",
  localized_slug: "signal-en",
  title: "Signal meme",
  summary: "An English meaning",
  description: "An English entry",
  origin: "A broadcast clip",
  usage_note: "Use with close friends",
  caution: "Do not target a real person",
  source_updated_at: "2026-08-08T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
});

describe("Plus collection brief route", () => {
  it("keeps signed-out and free users out of the owner-scoped query", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    await expect(POST(request({ collection: "Launch ideas", locale: "en" }))).resolves.toHaveProperty("status", 401);
    expect(from).not.toHaveBeenCalled();

    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: true, isPremium: false });
    await expect(POST(request({ collection: "Launch ideas", locale: "en" }))).resolves.toHaveProperty("status", 403);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a private attachment using only public rows from the selected saved collection", async () => {
    from.mockReturnValueOnce(savedQuery([savedRow])).mockReturnValueOnce(translationQuery([reviewedTranslation]));
    const response = await POST(request({ collection: "Launch ideas", locale: "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-language")).toBe("en");
    const body = await response.text();
    expect(body).toContain("# Launch ideas");
    expect(body).toContain("Current reviewed translation");
    expect(body).toContain("Use in the launch post");
    expect(from).toHaveBeenNthCalledWith(1, "saved_memes");
    expect(from).toHaveBeenNthCalledWith(2, "meme_translations");
  });

  it("uses an explicit Korean fallback when the requested reviewed translation is stale or missing", async () => {
    from.mockReturnValueOnce(savedQuery([savedRow])).mockReturnValueOnce(translationQuery([
      { ...reviewedTranslation, source_updated_at: "2026-08-07T00:00:00.000Z" },
    ]));
    const response = await POST(request({ collection: "Launch ideas", locale: "en" }));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Korean source fallback");
    expect(body).toContain("A short meaning");
  });

  it("accepts a browser form post and rejects an empty collection", async () => {
    const invalid = await POST(request(JSON.stringify({ collection: "", locale: "en" }), "application/x-www-form-urlencoded"));
    expect(invalid.status).toBe(400);

    const form = new URLSearchParams({ collection: "Launch ideas", locale: "ko" });
    from.mockReturnValueOnce(savedQuery([savedRow]));
    const response = await POST(request(form.toString(), "application/x-www-form-urlencoded"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-language")).toBe("ko");
  });

  it("does not turn a missing or failed collection query into a downloadable empty brief", async () => {
    from.mockReturnValueOnce(savedQuery([]));
    expect((await POST(request({ collection: "Missing", locale: "en" }))).status).toBe(404);

    from.mockReturnValueOnce(savedQuery([], 0, { message: "rls" }));
    expect((await POST(request({ collection: "Launch ideas", locale: "en" }))).status).toBe(500);
  });
});
