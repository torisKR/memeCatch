import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from "./route";

const id = "10000000-0000-4000-8000-000000000001";
function setup(options: { user?: { id: string } | null; status?: "pending" | "approved" | "rejected"; owner?: string; operator?: boolean }) {
  const listing = { id, owner_id: options.owner ?? "owner-1", image_path: `creator-products/${options.owner ?? "owner-1"}/image.png`, moderation_status: options.status ?? "approved" };
  const maybeSingle = vi.fn().mockResolvedValue({ data: listing, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const rpc = vi.fn().mockResolvedValue({ data: options.operator ?? false, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user ?? null } }) },
    from: vi.fn(() => ({ select })), rpc,
  });
  mocks.createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ download: mocks.download })) } });
  mocks.download.mockResolvedValue({ data: new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), error: null });
  return { maybeSingle, rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("creator product image access", () => {
  it("serves approved image bytes from the same origin without exposing a signed URL", async () => {
    setup({ status: "approved" });
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.arrayBuffer()).resolves.toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer);
    expect(mocks.download).toHaveBeenCalledWith("owner-1/image.png");
  });

  it("hides pending images from anonymous users and other owners", async () => {
    setup({ status: "pending" });
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) })).status).toBe(404);
    setup({ status: "pending", user: { id: "other-user" } });
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) })).status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("allows the owner and operator to preview an unapproved image", async () => {
    setup({ status: "pending", user: { id: "owner-1" } });
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) })).status).toBe(200);
    const admin = setup({ status: "pending", user: { id: "admin-1" }, operator: true });
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) })).status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith("is_operator");
  });
});
