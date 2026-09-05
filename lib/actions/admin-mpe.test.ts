import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { reprocessMpeJob, reviewMpeCandidate, reviewMpeClaim, saveMpeCandidateRevision, setMpeIngestionSourceRights } from "./admin-mpe";

function actionClient(options: {
  user?: { id: string } | null;
  role?: string;
  rpcError?: string;
  job?: { id: string; status: string; ingestion_id: string; media_ingestions: { user_id: string } } | null;
} = {}) {
  const jobRead = { select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: options.job, error: options.job === null ? { message: "missing" } : null }) };
  jobRead.select.mockReturnValue(jobRead);
  jobRead.eq.mockReturnValue(jobRead);
  const jobUpdate = { update: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
  jobUpdate.update.mockReturnValue(jobUpdate);
  jobUpdate.eq.mockReturnValue(jobUpdate);

  const from = vi.fn((table: string) => {
    if (table === "processing_jobs") return options.job === undefined ? jobUpdate : jobRead;
    throw new Error(`unexpected table ${table}`);
  });
  const rpc = vi.fn().mockResolvedValue({ data: {}, error: options.rpcError ? { message: options.rpcError } : null });
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? { id: "10000000-0000-4000-8000-000000000001" } : options.user } }) },
      from,
      rpc: vi.fn((name: string, args?: unknown) => name === "is_operator"
        ? Promise.resolve({ data: (options.role ?? "operator") === "operator", error: null })
        : rpc(name, args)),
    },
    rpc,
    jobRead,
    jobUpdate,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }) });
});

describe("MPE admin actions", () => {
  it("rejects unauthenticated and non-operator review requests before RPC", async () => {
    const signedOut = actionClient({ user: null });
    mocks.createClient.mockResolvedValueOnce(signedOut.client);
    await expect(reviewMpeCandidate({ candidateId: "20000000-0000-4000-8000-000000000002", stage: "FACT_CHECKING", decision: "APPROVED" })).resolves.toEqual({ ok: false, error: "로그인이 필요해요." });
    expect(signedOut.rpc).not.toHaveBeenCalled();

    const member = actionClient({ role: "user" });
    mocks.createClient.mockResolvedValueOnce(member.client);
    await expect(reviewMpeCandidate({ candidateId: "20000000-0000-4000-8000-000000000002", stage: "FACT_CHECKING", decision: "APPROVED" })).resolves.toEqual({ ok: false, error: "운영자 권한이 없어요." });
    expect(member.rpc).not.toHaveBeenCalled();
  });

  it("passes the exact candidate stage decision payload to the guarded RPC", async () => {
    const operator = actionClient();
    mocks.createClient.mockResolvedValue(operator.client);
    await expect(reviewMpeCandidate({ candidateId: "20000000-0000-4000-8000-000000000002", stage: "PUBLISH", decision: "LIMITED", reason: "권리 범위 제한" })).resolves.toEqual({ ok: true });
    expect(operator.rpc).toHaveBeenCalledWith("review_mpe_candidate", {
      p_candidate_id: "20000000-0000-4000-8000-000000000002",
      p_stage: "PUBLISH",
      p_decision: "LIMITED",
      p_reason: "권리 범위 제한",
    });
  });

  it("blocks stage skipping before calling the RPC", async () => {
    await expect(reviewMpeCandidate({ candidateId: "20000000-0000-4000-8000-000000000002", stage: "FACT_CHECKING", decision: "PUBLISHED" })).resolves.toEqual({ ok: false, error: "앞 단계를 건너뛰어 공개할 수 없어요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("saves the edited draft through the atomic revision RPC", async () => {
    const operator = actionClient();
    mocks.createClient.mockResolvedValue(operator.client);
    await expect(saveMpeCandidateRevision({ candidateId: "20000000-0000-4000-8000-000000000002", draft: { title: "수정 초안" } })).resolves.toEqual({ ok: true });
    expect(operator.rpc).toHaveBeenCalledWith("save_mpe_candidate_revision", {
      p_candidate_id: "20000000-0000-4000-8000-000000000002",
      p_draft_json: { title: "수정 초안" },
    });
  });

  it("stores source role and rights basis through the operator RPC", async () => {
    const operator = actionClient();
    mocks.createClient.mockResolvedValue(operator.client);
    await expect(setMpeIngestionSourceRights({ ingestionId: "40000000-0000-4000-8000-000000000004", sourceRole: "original", rightsBasis: "creator_permission" })).resolves.toEqual({ ok: true });
    expect(operator.rpc).toHaveBeenCalledWith("set_mpe_ingestion_source_rights", {
      p_ingestion_id: "40000000-0000-4000-8000-000000000004",
      p_source_role: "original",
      p_rights_basis: "creator_permission",
    });
  });

  it("only requeues a terminal job owned by the current operator", async () => {
    const operator = actionClient();
    mocks.createClient.mockResolvedValue(operator.client);

    await expect(reprocessMpeJob({ jobId: "30000000-0000-4000-8000-000000000003" })).resolves.toEqual({ ok: true });
    expect(operator.rpc).toHaveBeenCalledWith("reprocess_mpe_job", { p_job_id: "30000000-0000-4000-8000-000000000003" });
  });

  it("updates only the requested candidate claim", async () => {
    const operator = actionClient();
    mocks.createClient.mockResolvedValue(operator.client);
    await expect(reviewMpeClaim({ candidateId: "20000000-0000-4000-8000-000000000002", claimId: "50000000-0000-4000-8000-000000000005", decision: "APPROVED" })).resolves.toEqual({ ok: true });
    expect(operator.rpc).toHaveBeenCalledWith("review_mpe_claim", {
      p_candidate_id: "20000000-0000-4000-8000-000000000002",
      p_claim_id: "50000000-0000-4000-8000-000000000005",
      p_decision: "APPROVED",
    });
  });
});
