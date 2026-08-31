import { beforeEach, describe, expect, it, vi } from "vitest";

const getPremiumEntitlement = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ rpc }),
}));

import { POST } from "./route";

const memeId = "11111111-1111-4111-8111-111111111111";
const validBody = {
  memeId,
  locale: "en",
  channel: "threads",
  artifactKind: "creator_pack",
  mode: "one_cut",
  resultUrl: "https://example.com/post/1",
  performanceNote: "좋은 반응",
  privateNote: "첫 시도",
};

function request(body: unknown) {
  return new Request("http://localhost/api/plus/action-inbox/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
  rpc.mockResolvedValue({
    data: {
      completed: true,
      already_completed: false,
      already_recorded: false,
      receipt_id: "22222222-2222-4222-8222-222222222222",
      mode: "one_cut",
      completed_today_count: 1,
      current_streak: 2,
    },
    error: null,
  });
});

describe("Plus Action Inbox completion API", () => {
  it("rejects malformed receipt fields before RPC", async () => {
    const response = await POST(request({ ...validBody, memeId: "not-a-uuid" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_input" });
    expect(rpc).not.toHaveBeenCalled();

    const missingFields = await POST(request({ memeId }));
    expect(missingFields.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a saved result URL for One-Cut completion", async () => {
    const response = await POST(request({ ...validBody, resultUrl: null }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_input" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "ftp://example.com/post", "not-a-url"])(
    "rejects unsafe One-Cut result URLs before RPC: %s",
    async (resultUrl) => {
      const response = await POST(request({ ...validBody, resultUrl }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid_input" });
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("keeps legacy bulk requests without mode compatible", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        completed: true,
        receipt_id: "22222222-2222-4222-8222-222222222222",
        mode: "bulk",
        completed_today_count: 1,
        current_streak: 2,
      },
      error: null,
    });
    const response = await POST(
      request({
        ...validBody,
        mode: undefined,
        resultUrl: null,
        performanceNote: null,
        privateNote: null,
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_plus_meme_use_receipt", expect.objectContaining({
      p_result_url: null,
      p_performance_note: null,
      p_private_note: null,
      p_mode: "bulk",
    }));
  });

  it("keeps signed-out and free accounts out of the completion RPC", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    expect((await POST(request(validBody))).status).toBe(401);

    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: true, isPremium: false });
    const freeResponse = await POST(request(validBody));
    expect(freeResponse.status).toBe(403);
    await expect(freeResponse.json()).resolves.toEqual({ error: "plus_required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("forwards only server-safe receipt fields and returns the idempotent progress summary", async () => {
    const response = await POST(request({ ...validBody, userId: "attacker", completionDate: "1999-01-01" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_plus_meme_use_receipt", {
      p_artifact_kind: "creator_pack",
      p_channel: "threads",
      p_locale: "en",
      p_meme_id: memeId,
      p_mode: "one_cut",
      p_performance_note: "좋은 반응",
      p_private_note: "첫 시도",
      p_result_url: "https://example.com/post/1",
    });
    await expect(response.json()).resolves.toEqual({
      completed: true,
      alreadyCompleted: false,
      alreadyRecorded: false,
      receiptId: "22222222-2222-4222-8222-222222222222",
      mode: "one_cut",
      completedTodayCount: 1,
      currentStreak: 2,
    });
  });

  it("maps the server-side Plus gate", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "plus_required" } });
    const response = await POST(request(validBody));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "plus_required" });
  });

  it("returns a conflict when a same-day receipt retry changes meaning fields", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "receipt_conflict" } });
    const response = await POST(request({ ...validBody, channel: "x" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "receipt_conflict" });
  });

  it("fails closed when the database rejects an untrusted One-Cut", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "meme_not_trusted_for_one_cut" } });
    const response = await POST(request(validBody));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "meme_not_trusted_for_one_cut" });
  });

  it("rejects a receipt readback whose persisted mode differs from the request", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        completed: true,
        receipt_id: "22222222-2222-4222-8222-222222222222",
        mode: "bulk",
        completed_today_count: 1,
        current_streak: 2,
      },
      error: null,
    });
    const response = await POST(request(validBody));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "completion_failed" });
  });

  it("maps exact-locale validation failures without retrying the write", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "locale_unavailable" } });
    const response = await POST(request(validBody));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "locale_unavailable" });
  });
});
