import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createCandidateFromIngestion: vi.fn(),
  discardCreatedCandidate: vi.fn(),
  generateCandidateMatches: vi.fn(),
  listCandidateMatches: vi.fn(),
  generateEvidenceDraft: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/mpe/candidates.server", () => ({
  createCandidateFromIngestion: mocks.createCandidateFromIngestion,
  discardCreatedCandidate: mocks.discardCreatedCandidate,
  generateCandidateMatches: mocks.generateCandidateMatches,
  listCandidateMatches: mocks.listCandidateMatches,
  MpeCandidateError: class extends Error { constructor(message: string, readonly status = 500) { super(message); } },
}));
vi.mock("@/lib/mpe/evidence-draft.server", () => ({
  generateEvidenceDraft: mocks.generateEvidenceDraft,
  EvidenceDraftError: class extends Error { constructor(message: string, readonly status = 500) { super(message); } },
}));

import { GET, POST } from "./route";
import { EvidenceDraftError } from "@/lib/mpe/evidence-draft.server";

const candidateId = "10000000-0000-4000-8000-000000000001";

function authClient(user: { id: string } | null, role?: string) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: role === "operator", error: null }),
  };
}

function post(body: unknown) {
  return new Request("http://localhost/api/admin/mpe-candidates", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("admin MPE candidates API", () => {
  it("rejects a cross-origin POST before reading cookie-backed auth", async () => {
    const response = await POST(new Request("http://localhost/api/admin/mpe-candidates", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ candidateId }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_origin" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects signed-out and non-operator callers before generation", async () => {
    const signedOut = authClient(null);
    mocks.createClient.mockResolvedValueOnce(signedOut);
    expect((await POST(post({ candidateId }))).status).toBe(401);
    expect(signedOut.rpc).not.toHaveBeenCalled();

    mocks.createClient.mockResolvedValueOnce(authClient({ id: "member" }, "user"));
    expect((await POST(post({ candidateId }))).status).toBe(403);
    expect(mocks.generateCandidateMatches).not.toHaveBeenCalled();
  });

  it("generates matches and lists them for an operator", async () => {
    const operator = { id: "operator" };
    const client = authClient(operator, "operator");
    mocks.createClient.mockResolvedValueOnce(client).mockResolvedValueOnce(client);
    mocks.generateCandidateMatches.mockResolvedValueOnce([{ rank: 1, classification: "RELATED" }]);
    mocks.listCandidateMatches.mockResolvedValueOnce([{ rank: 1, classification: "RELATED" }]);

    const generated = await POST(post({ candidateId }));
    expect(generated.status).toBe(200);
    expect(mocks.generateCandidateMatches).toHaveBeenCalledWith(candidateId, client);

    const listed = await GET(new Request(`http://localhost/api/admin/mpe-candidates?candidateId=${candidateId}`));
    expect(listed.status).toBe(200);
    expect(mocks.listCandidateMatches).toHaveBeenCalledWith(candidateId, client);
  });

  it("can generate the evidence-linked draft through the same operator-only surface", async () => {
    const client = authClient({ id: "operator" }, "operator");
    mocks.createClient.mockResolvedValueOnce(client);
    mocks.generateEvidenceDraft.mockResolvedValueOnce({ mode: "fallback", claims: [] });

    const response = await POST(post({ candidateId, action: "evidence_draft" }));
    expect(response.status).toBe(200);
    expect(mocks.generateEvidenceDraft).toHaveBeenCalledWith(candidateId, client);
  });

  it("creates a candidate only through the safe server gate, then generates matches and evidence", async () => {
    const client = authClient({ id: "operator" }, "operator");
    mocks.createClient.mockResolvedValueOnce(client);
    mocks.createCandidateFromIngestion.mockResolvedValueOnce({
      created: true,
      candidate: { id: candidateId, review_status: "FACT_CHECKING" },
    });
    mocks.generateCandidateMatches.mockResolvedValueOnce([{ rank: 1 }]);
    mocks.generateEvidenceDraft.mockResolvedValueOnce({ mode: "fallback", claims: [{ field: "TITLE" }] });

    const response = await POST(post({
      action: "create",
      ingestionId: "20000000-0000-4000-8000-000000000002",
      title: "퇴근 밈",
      memeType: "PHRASE",
    }));

    expect(response.status).toBe(200);
    expect(mocks.createCandidateFromIngestion).toHaveBeenCalledWith({
      ingestionId: "20000000-0000-4000-8000-000000000002",
      title: "퇴근 밈",
      memeType: "PHRASE",
    }, client);
    expect(mocks.generateCandidateMatches).toHaveBeenCalledWith(candidateId, client);
    expect(mocks.generateEvidenceDraft).toHaveBeenCalledWith(candidateId, client);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { created: true, candidate: { review_status: "FACT_CHECKING" } },
    });
  });

  it("removes a newly created candidate when evidence drafting fails", async () => {
    const client = authClient({ id: "operator" }, "operator");
    mocks.createClient.mockResolvedValueOnce(client);
    mocks.createCandidateFromIngestion.mockResolvedValueOnce({ created: true, candidate: { id: candidateId } });
    mocks.generateCandidateMatches.mockResolvedValueOnce([]);
    mocks.generateEvidenceDraft.mockRejectedValueOnce(new EvidenceDraftError("draft_provider_not_configured", 503));
    mocks.discardCreatedCandidate.mockResolvedValueOnce(undefined);

    const response = await POST(post({
      action: "create",
      ingestionId: "20000000-0000-4000-8000-000000000002",
      title: "근거 없는 업로드",
      memeType: "PHRASE",
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "draft_provider_not_configured" });
    expect(mocks.discardCreatedCandidate).toHaveBeenCalledWith(candidateId, client);
  });

  it("returns existing candidate data without regenerating matches or draft when created is false", async () => {
    const client = authClient({ id: "operator" }, "operator");
    mocks.createClient.mockResolvedValueOnce(client);
    mocks.createCandidateFromIngestion.mockResolvedValueOnce({
      created: false,
      candidate: { id: candidateId, review_status: "FACT_CHECKING", draft_json: { title: "기존 초안" } },
    });
    mocks.listCandidateMatches.mockResolvedValueOnce([{ rank: 1, classification: "RELATED" }]);

    const response = await POST(post({
      action: "create",
      ingestionId: "20000000-0000-4000-8000-000000000002",
      title: "이미 생성된 밈",
      memeType: "PHRASE",
    }));

    expect(response.status).toBe(200);
    expect(mocks.generateCandidateMatches).not.toHaveBeenCalled();
    expect(mocks.generateEvidenceDraft).not.toHaveBeenCalled();
    expect(mocks.listCandidateMatches).toHaveBeenCalledWith(candidateId, client);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { created: false, draft: { title: "기존 초안" }, matches: [{ rank: 1 }] },
    });
  });
});
