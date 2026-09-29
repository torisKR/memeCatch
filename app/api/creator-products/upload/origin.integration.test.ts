import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://catchmeme.com" }));
const { createClient, createAdminClient, getUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  createClient.mockResolvedValue({ auth: { getUser } });
});

describe("creator product upload preserves original origin security", () => {
  it.each([
    ["foreign origin", { origin: "https://attacker.invalid" }],
    ["null origin", { origin: "null" }],
    ["missing origin context", {}],
    ["cross-site fetch context", { "sec-fetch-site": "cross-site" }],
    ["foreign origin despite same-origin hint", { origin: "https://attacker.invalid", "sec-fetch-site": "same-origin" }],
  ] as const)("rejects %s before reading credentials or storage", async (_name, headers) => {
    const request = new Request("https://catchmeme.com/api/creator-products/upload", {
      method: "POST", headers,
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: "invalid_origin" });
    expect(createClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { origin: "https://catchmeme.com" },
    { "sec-fetch-site": "same-origin" },
  ])("keeps the anonymous authentication gate for trusted requests %j", async (headers) => {
    const response = await POST(new Request("https://catchmeme.com/api/creator-products/upload", {
      method: "POST", headers,
    }));
    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledOnce();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("accepts same-origin local QA without changing canonical site configuration", async () => {
    const response = await POST(new Request("http://127.0.0.1:3105/api/creator-products/upload", {
      method: "POST", headers: { origin: "http://127.0.0.1:3105" },
    }));
    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledOnce();
  });
});
