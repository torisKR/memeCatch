import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  r2Configured: vi.fn(() => false),
  r2Put: vi.fn(),
  rateLimit: vi.fn(() => ({ ok: true })),
  storageUpload: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/r2.server", () => ({
  r2Configured: mocks.r2Configured,
  r2Put: mocks.r2Put,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { NextRequest } from "next/server";
import { POST } from "./route";

function request(type = "image/png", bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) {
  const form = new FormData();
  form.set("file", new File([Uint8Array.from(bytes)], "meme.png", { type }));
  return new NextRequest("http://localhost/api/upload", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.r2Configured.mockReturnValue(false);
  mocks.rateLimit.mockReturnValue({ ok: true });
  mocks.storageUpload.mockResolvedValue({ data: { path: "user-1/file.png" }, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    storage: { from: () => ({ upload: mocks.storageUpload }) },
  });
});

describe("community upload API", () => {
  it("rejects a declared image whose bytes are another media type", async () => {
    const response = await POST(request("image/jpeg"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_type" });
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it("stores a valid image with the existing path contract", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      path: "meme-uploads/user-1/file.png",
    });
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/[0-9a-f-]+\.png$/),
      expect.any(File),
      expect.objectContaining({ contentType: "image/png" }),
    );
  });
});
