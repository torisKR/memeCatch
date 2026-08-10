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

function request(body: unknown) {
  return new Request("http://localhost/api/plus/global-daily/complete", {
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
      challenge_date: "2026-08-09",
      locale: "en",
      current_streak: 1,
    },
    error: null,
  });
});

describe("Global Meme Daily completion API", () => {
  it("rejects invalid input before checking the completion RPC", async () => {
    const response = await POST(request({ locale: "fr", date: "2026-08-09", memeId: "fake" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_input" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps signed-out and free accounts out of the RPC", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    expect((await POST(request({ locale: "en" }))).status).toBe(401);
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: true, isPremium: false });
    const freeResponse = await POST(request({ locale: "en" }));
    expect(freeResponse.status).toBe(403);
    await expect(freeResponse.json()).resolves.toEqual({ error: "plus_required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends only the locale to the current-day completion RPC", async () => {
    const response = await POST(request({
      locale: "en",
      userId: "attacker",
      challengeDate: "1999-01-01",
      memeId: "other-meme",
    }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("complete_plus_global_daily_challenge", { p_locale: "en" });
    await expect(response.json()).resolves.toEqual({
      completed: true,
      alreadyCompleted: false,
      challengeDate: "2026-08-09",
      locale: "en",
      currentStreak: 1,
    });
  });

  it("returns the idempotent completion state when called again", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        completed: true,
        already_completed: true,
        challenge_date: "2026-08-09",
        locale: "ja",
        current_streak: 4,
      },
      error: null,
    });
    const response = await POST(request({ locale: "ja" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      completed: true,
      alreadyCompleted: true,
      currentStreak: 4,
    });
  });
});
