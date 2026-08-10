import { beforeEach, describe, expect, it, vi } from "vitest";

const getPremiumEntitlement = vi.fn();
const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ rpc, from }),
}));

import { GET, POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/translation-priority", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function statusQuery(result: unknown, error: { message: string } | null = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
});

describe("translation priority API", () => {
  it("keeps signed-out and free accounts out of the request RPC", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    await expect(POST(request({ memeId: "meme-1", locale: "en" }))).resolves.toHaveProperty("status", 401);

    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: true, isPremium: false });
    await expect(POST(request({ memeId: "meme-1", locale: "en" }))).resolves.toHaveProperty("status", 403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps the saved-meme gate and forwards a valid Plus request", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "saved_meme_required" } });
    const blocked = await POST(request({ memeId: "meme-1", locale: "en" }));
    expect(blocked.status).toBe(409);
    await expect(blocked.json()).resolves.toEqual({ error: "save_required" });

    rpc.mockResolvedValueOnce({
      data: { status: "requested", requestId: "request-1" },
      error: null,
    });
    const response = await POST(request({ memeId: "meme-1", locale: "ja" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith("request_plus_translation", {
      p_meme_id: "meme-1",
      p_locale: "ja",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "requested",
      requestId: "request-1",
    });
  });

  it("returns the owner-scoped completion state for an active Plus member", async () => {
    from.mockReturnValue(
      statusQuery({
        status: "completed",
        created_at: "2026-08-09T01:00:00.000Z",
        updated_at: "2026-08-09T02:00:00.000Z",
        completed_at: "2026-08-09T02:00:00.000Z",
      }),
    );
    const response = await GET(
      new Request("http://localhost/api/translation-priority?memeId=meme-1&locale=zh"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ locked: false, status: "completed" });
    expect(from).toHaveBeenCalledWith("plus_translation_requests");
  });
});
