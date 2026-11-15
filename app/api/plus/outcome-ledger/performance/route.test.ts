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
  return new Request("http://localhost/api/plus/outcome-ledger/performance", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
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
      performance_note: "좋은 반응",
    },
    error: null,
  });
});

describe("Plus outcome performance API", () => {
  it("rejects a cross-origin update before parsing or entitlement checks", async () => {
    const response = await POST(new Request("http://localhost/api/plus/outcome-ledger/performance", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ receiptId, performanceNote: "메모" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "invalid_origin" });
    expect(getPremiumEntitlement).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects empty, oversized, and malformed input before RPC", async () => {
    expect((await POST(request({ receiptId, performanceNote: " " }))).status).toBe(400);
    expect((await POST(request({ receiptId, performanceNote: "x".repeat(1001) }))).status).toBe(400);
    expect((await POST(request({ receiptId: "not-a-uuid", performanceNote: "메모" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps signed-out and free accounts out of the RPC", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    expect((await POST(request({ receiptId, performanceNote: "메모" }))).status).toBe(401);

    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: true, isPremium: false });
    expect((await POST(request({ receiptId, performanceNote: "메모" }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("updates one owner-scoped receipt and returns only the bounded note", async () => {
    const response = await POST(request({ receiptId, performanceNote: "  좋은 반응  ", ignored: "x" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_plus_meme_use_performance", {
      p_performance_note: "좋은 반응",
      p_receipt_id: receiptId,
    });
    await expect(response.json()).resolves.toEqual({
      updated: true,
      receiptId,
      performanceNote: "좋은 반응",
    });
  });

  it("preserves the input when a receipt was already updated", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "performance_already_recorded" } });
    const response = await POST(request({ receiptId, performanceNote: "다음 시도" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "performance_already_recorded" });
  });
});
