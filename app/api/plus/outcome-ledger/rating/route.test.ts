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

const receiptId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new Request("http://localhost/api/plus/outcome-ledger/rating", {
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
      updated: true,
      receipt_id: receiptId,
      performance_rating: "hit",
    },
    error: null,
  });
});

describe("Plus outcome rating API", () => {
  it("rejects malformed ratings before RPC", async () => {
    expect((await POST(request({ receiptId, performanceRating: "" }))).status).toBe(400);
    expect((await POST(request({ receiptId, performanceRating: "great" }))).status).toBe(400);
    expect((await POST(request({ receiptId: "not-a-uuid", performanceRating: "hit" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps signed-out and free accounts out of the RPC", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    expect((await POST(request({ receiptId, performanceRating: "hit" }))).status).toBe(401);

    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: true, isPremium: false });
    expect((await POST(request({ receiptId, performanceRating: "hit" }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records one bounded owner-scoped rating", async () => {
    const response = await POST(
      request({ receiptId, performanceRating: "hit", ignored: "private note" }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_plus_meme_use_rating", {
      p_performance_rating: "hit",
      p_receipt_id: receiptId,
    });
    await expect(response.json()).resolves.toEqual({
      updated: true,
      receiptId,
      performanceRating: "hit",
    });
  });

  it("preserves one-time rating semantics", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "rating_already_recorded" } });
    const response = await POST(request({ receiptId, performanceRating: "miss" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "rating_already_recorded" });
  });
});
