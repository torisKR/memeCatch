import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  ingestSource: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/sources/ingest.server", () => ({
  ingestSource: mocks.ingestSource,
  SourceIngestionError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly code: string = "db_failure",
      readonly retryable = false,
    ) {
      super(message);
    }
  },
}));

import { POST } from "./route";
import { SourceIngestionError } from "@/lib/sources/ingest.server";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/source-ingestions", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

function authClient(user: { id: string } | null, role?: string) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: role === "operator", error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin source ingestion API", () => {
  it("rejects a cross-origin request before reading cookie-backed auth", async () => {
    const response = await POST(new Request("http://localhost/api/admin/source-ingestions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abcdefghijk" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_origin" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects signed-out and non-operator callers before ingestion or upstream work", async () => {
    const signedOut = authClient(null);
    mocks.createClient.mockResolvedValueOnce(signedOut);
    expect((await POST(request({ url: "https://www.youtube.com/watch?v=abcdefghijk" }))).status).toBe(401);
    expect(signedOut.rpc).not.toHaveBeenCalled();

    const member = authClient({ id: "10000000-0000-4000-8000-000000000001" }, "user");
    mocks.createClient.mockResolvedValueOnce(member);
    expect((await POST(request({ url: "https://www.youtube.com/watch?v=abcdefghijk" }))).status).toBe(403);

    expect(mocks.ingestSource).not.toHaveBeenCalled();
  });

  it("forwards a validated request for an operator and returns the pending candidate", async () => {
    const user = { id: "10000000-0000-4000-8000-000000000001" };
    mocks.createClient.mockResolvedValueOnce(authClient(user, "operator"));
    mocks.ingestSource.mockResolvedValueOnce({
      id: "50000000-0000-4000-8000-000000000005",
      status: "linked",
      platform: "youtube",
      externalId: "abcdefghijk",
      canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      title: "테스트 영상",
      author: "채널",
      rightsMode: "METADATA_ONLY",
      duplicate: false,
    });

    const response = await POST(request({
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      targetMemeId: "30000000-0000-4000-8000-000000000003",
    }));

    expect(response.status).toBe(200);
    expect(mocks.ingestSource).toHaveBeenCalledWith({
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      targetMemeId: "30000000-0000-4000-8000-000000000003",
    }, user.id);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        status: "linked",
        rightsMode: "METADATA_ONLY",
        duplicate: false,
      },
    });
  });

  it("returns stable retry metadata for a transient failure", async () => {
    const user = { id: "10000000-0000-4000-8000-000000000001" };
    mocks.createClient.mockResolvedValueOnce(authClient(user, "operator"));
    mocks.ingestSource.mockRejectedValueOnce(
      new SourceIngestionError("provider unavailable", 502, "provider_transient", true),
    );

    const response = await POST(request({
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      targetMemeId: "30000000-0000-4000-8000-000000000003",
      retry: true,
    }));

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "provider unavailable",
      code: "provider_transient",
      retryable: true,
    });
    expect(response.status).toBe(502);
  });

  it("does not accept a false retry marker", async () => {
    const user = { id: "10000000-0000-4000-8000-000000000001" };
    mocks.createClient.mockResolvedValueOnce(authClient(user, "operator"));

    const response = await POST(request({
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      retry: false,
    }));

    expect(response.status).toBe(400);
    expect(mocks.ingestSource).not.toHaveBeenCalled();
  });
});
