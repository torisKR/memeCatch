import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  r2Configured: vi.fn(),
  r2Get: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/r2.server", () => ({
  r2Configured: mocks.r2Configured,
  r2Get: mocks.r2Get,
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

function request(path: string[]) {
  return GET(new NextRequest(`http://localhost/api/media/${path.join("/")}`), {
    params: Promise.resolve({ path }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.r2Configured.mockReturnValue(true);
  mocks.r2Get.mockResolvedValue({
    ok: true,
    body: new Uint8Array([1, 2, 3]),
    headers: new Headers({ "Content-Type": "text/html" }),
  });
});

describe("media proxy", () => {
  it("rejects active or unknown file extensions before reading storage", async () => {
    const response = await request(["meme-thumbs", "provider", "payload.html"]);

    expect(response.status).toBe(404);
    expect(mocks.r2Get).not.toHaveBeenCalled();
  });

  it("pins the response MIME to the allowed extension instead of storage metadata", async () => {
    const response = await request(["meme-thumbs", "provider", "thumb.png"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
  });

  it("serves generated poster art as a public cached image", async () => {
    const response = await request(["meme-art", "jkm2022k.png"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("allows CDN caching of public thumbnails in the Storage fallback", async () => {
    mocks.r2Configured.mockReturnValue(false);
    const download = vi.fn().mockResolvedValue({ data: new Blob(["image"]), error: null });
    mocks.createAdminClient.mockReturnValue({ storage: { from: () => ({ download }) } });
    const response = await request(["meme-thumbs", "provider", "thumb.png"]);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("never caches private uploads in the Storage fallback", async () => {
    mocks.r2Configured.mockReturnValue(false);
    mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } });
    mocks.createAdminClient.mockReturnValue({ storage: { from: () => ({ download: async () => ({ data: new Blob(["image"]), error: null }) }) } });
    const response = await request(["meme-uploads", "owner", "image.png"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("denies unapproved uploads before either storage provider", async () => {
    mocks.r2Configured.mockReturnValue(false);
    mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    const chain = { select: vi.fn(), eq: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [] }) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    const download = vi.fn();
    mocks.createAdminClient.mockReturnValue({ from: () => chain, storage: { from: () => ({ download }) } });
    expect((await request(["meme-uploads", "owner", "image.png"])).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
    expect(mocks.r2Get).not.toHaveBeenCalled();
  });
});
