import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  recordCleanupFailure: vi.fn(),
  rateLimit: vi.fn(() => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/mpe/storage.server", () => ({
  putTemporaryMedia: mocks.put,
  deleteTemporaryMedia: mocks.remove,
  recordTemporaryCleanupFailure: mocks.recordCleanupFailure,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "./route";

function client(
  user: { id: string } | null,
  rpc = vi.fn().mockResolvedValue({ error: null }),
) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, rpc };
}

function uploadRequest(options: { rights?: boolean; type?: string; bytes?: number[] } = {}) {
  const form = new FormData();
  form.set("file", new File([
    Uint8Array.from(options.bytes ?? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], "meme.png", { type: options.type ?? "image/png" }));
  form.set("rightsDeclaration", JSON.stringify({ accepted: options.rights ?? true }));
  return new Request("http://localhost/api/mpe/uploads", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.put.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.recordCleanupFailure.mockResolvedValue(undefined);
});

describe("MPE upload API", () => {
  it("requires authentication and an accepted rights declaration", async () => {
    mocks.createClient.mockResolvedValueOnce(client(null));
    expect((await POST(uploadRequest())).status).toBe(401);

    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }));
    expect((await POST(uploadRequest({ rights: false }))).status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects content-type spoofing before storage", async () => {
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }));
    const response = await POST(uploadRequest({ type: "image/jpeg" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "mime_mismatch" });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("does not accept an arbitrary source association", async () => {
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }));
    const request = uploadRequest();
    const form = await request.formData();
    form.set("sourceId", "10000000-0000-4000-8000-000000000001");
    const response = await POST(new Request(request.url, { method: "POST", body: form }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "source_not_allowed" });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("stores validated bytes and creates processing jobs", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        data: [{ ingestion_id: "ingestion-1", job_ids: ["job-1", "job-2"] }], error: null,
      });
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(201);
    expect(mocks.put).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\//), expect.any(ArrayBuffer), "image/png",
    );
    expect(rpc).toHaveBeenCalledWith("create_metered_media_ingestion", expect.objectContaining({
      p_ingest_mode: "USER_UPLOADED", p_rights_accepted: true, p_media_kind: "image",
    }));
  });

  it("stops before temporary storage when the durable quota is exhausted", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "api_rate_limited" } });
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));

    const response = await POST(uploadRequest());

    expect(response.status).toBe(429);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("cleans up and returns 429 when the ingestion quota is exhausted", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "api_rate_limited" } });
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));

    const response = await POST(uploadRequest());

    expect(response.status).toBe(429);
    expect(mocks.remove).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
  });

  it("deletes the temporary object when the DB transaction fails", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("db") });
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
  });

  it("returns a distinct error when orphan cleanup also fails", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("db") });
    mocks.remove.mockRejectedValueOnce(new Error("storage"));
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "ingestion_failed_cleanup_failed" });
    expect(mocks.recordCleanupFailure).toHaveBeenCalledWith(mocks.put.mock.calls[0][0], "user-1");
  });
});
