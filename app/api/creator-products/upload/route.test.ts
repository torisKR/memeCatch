import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(),
  rateLimit: vi.fn((): { ok: boolean; retryAfterSec?: number } => ({ ok: true })),
  list: vi.fn(), upload: vi.fn(), storageFrom: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "./route";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Y1sAAAAASUVORK5CYII=",
  "base64",
);
const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function request(bytes: Uint8Array = validPng) {
  const form = new FormData();
  const contents = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(contents).set(bytes);
  form.set("file", new File([contents], "product.png", { type: "image/png" }));
  return new Request("http://localhost/api/creator-products/upload", {
    method: "POST", body: form, headers: { origin: "http://localhost" },
  });
}
function client(user: { id: string } | null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, rpc: mocks.rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockReturnValue({ ok: true });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.upload.mockResolvedValue({ data: { path: "owner-1/file.png" }, error: null });
  mocks.storageFrom.mockReturnValue({ list: mocks.list, upload: mocks.upload });
  mocks.createAdminClient.mockReturnValue({ storage: { from: mocks.storageFrom } });
});

describe("creator product image upload", () => {
  it("rejects anonymous uploads", async () => {
    mocks.createClient.mockResolvedValue(client(null));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("stores validated images in the dedicated bucket and owner folder", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));
    const response = await POST(request());
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ ok: true, path: expect.stringMatching(/^creator-products\/owner-1\//) });
    expect(mocks.storageFrom).toHaveBeenCalledWith("creator-products");
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_creator_product_upload");
    expect(mocks.list).toHaveBeenCalledWith("owner-1", {
      limit: 21,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
  });

  it("applies the per-user rate limit and rejects invalid image bytes", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));
    mocks.rateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 30 });
    expect((await POST(request())).status).toBe(429);
    mocks.rateLimit.mockReturnValueOnce({ ok: true });
    const form = new FormData();
    form.set("file", new File(["not a png"], "bad.png", { type: "image/png" }));
    expect((await POST(new Request("http://localhost/api/creator-products/upload", {
      method: "POST", body: form, headers: { origin: "http://localhost" },
    }))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects a PNG signature without structural chunks", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));

    const response = await POST(request(pngHeader));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_image" });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("caps each owned storage folder at twenty objects using a bounded list", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));
    mocks.list.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, index) => ({ name: `${index}.png` })),
      error: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: "storage_quota_exceeded" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("fails closed when the owned-folder object count cannot be checked", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));
    mocks.list.mockResolvedValue({ data: null, error: { message: "storage unavailable" } });

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "storage_quota_unavailable" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("stops when the durable upload quota is exhausted", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));
    mocks.rpc.mockResolvedValue({ error: { message: "api_rate_limited" } });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("fails closed if the creator upload quota cannot be checked", async () => {
    mocks.createClient.mockResolvedValue(client({ id: "owner-1" }));
    mocks.rpc.mockResolvedValue({ error: { message: "quota unavailable" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
