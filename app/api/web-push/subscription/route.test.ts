import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  entitlement: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: mocks.entitlement,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("server-only", () => ({}));

import { DELETE, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.entitlement.mockResolvedValue({ signedIn: true, isPremium: true });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe("web push subscription route", () => {
  it("stores only an authenticated Plus user's browser subscription", async () => {
    const response = await POST(new Request("https://memecatch.test/api/web-push/subscription", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "test-browser" },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/one",
        keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("set_web_push_subscription", {
      p_endpoint: "https://fcm.googleapis.com/fcm/send/one",
      p_p256dh: "a".repeat(87),
      p_auth: "b".repeat(22),
      p_user_agent: "test-browser",
    });
  });

  it.each([
    "https://127.0.0.1/push",
    "https://unsupported.example.test/push",
    "https://fcm.googleapis.com.evil.test/push",
  ])("rejects an unsupported endpoint before persistence: %s", async (endpoint) => {
    const response = await POST(new Request("https://memecatch.test/api/web-push/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
      }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses to remove other browser subscriptions without an exact endpoint", async () => {
    const response = await DELETE(new Request("https://memecatch.test/api/web-push/subscription", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: null }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("removes only the authenticated user's matching browser subscription", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/one";
    const response = await DELETE(new Request("https://memecatch.test/api/web-push/subscription", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("remove_web_push_subscription", { p_endpoint: endpoint });
  });
});
