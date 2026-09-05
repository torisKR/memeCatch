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
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/source-ingestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
});
