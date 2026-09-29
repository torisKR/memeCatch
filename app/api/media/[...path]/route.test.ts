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
  });
});
