import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(), select: vi.fn(), eq: vi.fn(), from: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));

import { POST } from "./route";

const secret = "worker-webhook-secret-that-is-at-least-32-bytes";
const publicationId = "11111111-1111-4111-8111-111111111111";
const productionId = "22222222-2222-4222-8222-222222222222";
const memeId = "33333333-3333-4333-8333-333333333333";
const artifactHash = "a".repeat(64);

function signedRequest(body: string, options: { timestamp?: number; signature?: string; length?: string } = {}) {
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = options.signature ?? createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return new Request("https://catchmeme.com/api/admin/video-productions/worker-sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-worker-timestamp": timestamp,
      "x-video-worker-signature": signature,
      ...(options.length ? { "content-length": options.length } : {}),
    },
    body,
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ publicationId, artifactHash, ...overrides });
}

beforeEach(() => {
  vi.stubEnv("VIDEO_WORKER_WEBHOOK_SECRET", secret);
  mocks.maybeSingle.mockResolvedValue({ data: {
    artifact_hash: artifactHash,
    production_id: productionId,
    site_linked_at: "2026-10-12T13:00:00Z",
    status: "site_linked",
    production: { meme_id: memeId },
  }, error: null });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST video worker cache sync", () => {
  it("rejects a bad signature before any database read", async () => {
    const response = await POST(signedRequest(payload(), { signature: "0".repeat(64) }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_worker_signature" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects timestamps outside the sixty-second window before reading the body or database", async () => {
    const response = await POST(signedRequest(payload(), { timestamp: Math.floor(Date.now() / 1000) - 61 }));
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("bounds the raw request body to four KiB", async () => {
    const response = await POST(signedRequest(payload(), { length: "4097" }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "body_too_large" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    JSON.stringify({ publicationId, artifactHash, extra: true }),
    JSON.stringify({ publicationId: "not-a-uuid", artifactHash }),
    JSON.stringify({ publicationId, artifactHash: "A".repeat(64) }),
    "{not-json",
  ])("rejects a signed but invalid strict body", async (body) => {
    const response = await POST(signedRequest(body));
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an artifact hash that does not match current authoritative state", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: {
      artifact_hash: "b".repeat(64), production_id: productionId, site_linked_at: "2026-10-12T13:00:00Z",
      status: "site_linked", production: { meme_id: memeId },
    }, error: null });
    const response = await POST(signedRequest(payload()));
    expect(response.status).toBe(409);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates the public catalog and both meme route patterns for an authoritative linked publication", async () => {
    const response = await POST(signedRequest(payload()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });
    expect(mocks.select).toHaveBeenCalledWith("artifact_hash,production_id,site_linked_at,status,production:video_productions!inner(meme_id)");
    expect(mocks.eq).toHaveBeenCalledWith("id", publicationId);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(default)/memes/[key]", "page");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/[locale]/memes/[key]", "page");
  });

  it.each(["unavailable", "blocked"])("allows cache-only unlink sync for %s only after the site link is cleared", async (status) => {
    mocks.maybeSingle.mockResolvedValue({ data: {
      artifact_hash: artifactHash, production_id: productionId, site_linked_at: null,
      status, production: [{ meme_id: memeId }],
    }, error: null });
    expect((await POST(signedRequest(payload()))).status).toBe(200);
    mocks.maybeSingle.mockResolvedValue({ data: {
      artifact_hash: artifactHash, production_id: productionId, site_linked_at: "2026-10-12T13:00:00Z",
      status, production: { meme_id: memeId },
    }, error: null });
    expect((await POST(signedRequest(payload()))).status).toBe(409);
  });

  it("is replay-idempotent because repeated valid deliveries only invalidate caches", async () => {
    const requestBody = payload();
    expect((await POST(signedRequest(requestBody))).status).toBe(200);
    expect((await POST(signedRequest(requestBody))).status).toBe(200);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
  });
});
