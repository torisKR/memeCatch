import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("server-only", () => ({}));

import { GET } from "./route";

function client(user: { id: string } | null, data: unknown = null, error: unknown = null) {
  const query = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue(query),
    query,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("MPE job status API", () => {
  it("rejects signed-out callers", async () => {
    mocks.createClient.mockResolvedValueOnce(client(null));
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "job-1" }) })).status).toBe(401);
  });

  it("returns 404 when owner/operator RLS hides the job", async () => {
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }));
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "job-1" }) })).status).toBe(404);
  });

  it("returns a safe status DTO without processor or storage details", async () => {
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, {
      id: "job-1", ingestion_id: "ing-1", job_type: "inspect_media", status: "completed", attempts: 1,
      output_json: { width: 1200 }, error_code: null, started_at: "start", completed_at: "end", created_at: "created",
      processor_name: "secret-worker", temporary_storage_key: "private/key",
    }));
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "job-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: "job-1", ingestionId: "ing-1", status: "completed" });
    expect(JSON.stringify(body)).not.toContain("secret-worker");
    expect(JSON.stringify(body)).not.toContain("private/key");
  });

  it("signs a completed owner-visible render without exposing the private artifact key", async () => {
    const artifactKey = "10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/renders/" + "a".repeat(64) + ".mp4";
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, {
      id: "job-1", ingestion_id: "ing-1", job_type: "render", status: "completed", attempts: 1,
      output_json: { artifactKey, preset: "vertical", width: 1080, height: 1920 },
      error_code: null, started_at: "start", completed_at: "end", created_at: "created",
    }));
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/render" }, error: null });
    mocks.createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } });

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "job-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.downloadUrl).toBe("https://signed.example/render");
    expect(body.data.downloadExpiresIn).toBe(60);
    expect(JSON.stringify(body)).not.toContain(artifactKey);
    expect(createSignedUrl).toHaveBeenCalledWith(artifactKey, 60, { download: "memecatch-render.mp4" });
  });
});
