import { beforeEach, describe, expect, it, vi } from "vitest";

const getPremiumEntitlement = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

import { POST } from "./route";

beforeEach(() => {
  getPremiumEntitlement.mockReset();
  rpc.mockReset();
  createClient.mockClear();
});

describe("saved context alert read marking", () => {
  it("does not allow signed-out visitors to mark alerts", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: false, isPremium: false });

    const response = await POST();

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps the endpoint Plus-only", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: false });

    const response = await POST();

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the self-scoped read RPC for active Plus members", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
    rpc.mockResolvedValue({ data: 3, error: null });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("mark_saved_context_alerts_read");
    await expect(response.json()).resolves.toEqual({ ok: true, marked: 3 });
  });
});
