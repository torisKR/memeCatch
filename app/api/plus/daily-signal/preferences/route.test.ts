import { beforeEach, describe, expect, it, vi } from "vitest";

const getPremiumEntitlement = vi.fn();
const rpc = vi.fn();
const from = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ rpc, from }),
}));

import { GET, POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/plus/daily-signal/preferences", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

function preferenceQuery(result: unknown, error: { message: string } | null = null) {
  const builder = { select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: result, error }) };
  builder.select.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
});

describe("Plus Daily Signal preference API", () => {
  it("rejects a cross-origin preference before parsing or entitlement checks", async () => {
    const response = await POST(new Request("http://localhost/api/plus/daily-signal/preferences", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ enabled: true, locale: "en" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "invalid_origin" });
    expect(getPremiumEntitlement).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps signed-out users out of the preference RPC", async () => {
    getPremiumEntitlement.mockResolvedValueOnce({ signedIn: false, isPremium: false });
    const response = await POST(request({ enabled: true, locale: "en" }));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates locale and forwards a valid preference", async () => {
    const invalid = await POST(request({ enabled: true, locale: "fr" }));
    expect(invalid.status).toBe(400);

    rpc.mockResolvedValueOnce({ data: { enabled: true, locale: "ja", timezone: "Asia/Seoul" }, error: null });
    const response = await POST(request({ enabled: true, locale: "ja" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("set_plus_digest_preferences", {
      p_enabled: true,
      p_locale: "ja",
    });
    await expect(response.json()).resolves.toMatchObject({ ok: true, enabled: true, locale: "ja" });
  });

  it("maps the Plus gate and exposes the owner-scoped preference", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "plus_required" } });
    await expect(POST(request({ enabled: true, locale: "en" }))).resolves.toHaveProperty("status", 403);

    from.mockReturnValue(preferenceQuery({ enabled: true, locale: "en", timezone: "Asia/Seoul" }));
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ plus: true, enabled: true, locale: "en" });
    expect(from).toHaveBeenCalledWith("plus_digest_preferences");
  });
});
