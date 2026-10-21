import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

import { reviewTrendCandidate } from "./trend-candidates";

const candidateId = "11111111-1111-4111-8111-111111111111";
const targetMemeId = "22222222-2222-4222-8222-222222222222";
const targetCandidateId = "33333333-3333-4333-8333-333333333333";
const signalId = "44444444-4444-4444-8444-444444444444";

const baseInput = {
  candidateId,
  decision: "hold",
  note: "근거 확인 중",
  publicSummary: "",
  evidenceScope: "",
  evidenceLinks: "",
  targetMemeId: "",
  targetCandidateId: "",
  splitSignalIds: "",
};

function operatorClient(reviewResult: { data: unknown; error: { message: string } | null } = { data: {}, error: null }) {
  const rpc = vi.fn(async (name: string) =>
    name === "is_operator" ? { data: true, error: null } : reviewResult,
  );
  return {
    rpc,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "operator" } } })) },
  };
}

describe("reviewTrendCandidate integrity validation", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it.each(["link_existing", "link_alias"])("requires a real meme target for %s before any database call", async (decision) => {
    const result = await reviewTrendCandidate({ ...baseInput, decision });

    expect(result).toEqual({ ok: false, error: "연결할 기존 밈 UUID를 입력해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires another candidate and explicit signal IDs for split", async () => {
    await expect(reviewTrendCandidate({
      ...baseInput,
      decision: "split",
      targetCandidateId,
    })).resolves.toEqual({ ok: false, error: "분리할 사용례를 하나 이상 선택해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects private or local evidence links before authentication", async () => {
    await expect(reviewTrendCandidate({
      ...baseInput,
      evidenceLinks: "내부 링크 | https://127.0.0.1/source",
    })).resolves.toEqual({ ok: false, error: "근거 링크 1의 URL을 확인해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires authenticated operator access", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      rpc: vi.fn(),
    });

    await expect(reviewTrendCandidate(baseInput)).resolves.toEqual({ ok: false, error: "로그인이 필요해요." });
  });

  it("passes merge and split integrity parameters to the RPC", async () => {
    const client = operatorClient();
    mocks.createClient.mockResolvedValue(client);

    const result = await reviewTrendCandidate({
      ...baseInput,
      decision: "split",
      targetCandidateId,
      splitSignalIds: `${signalId},${signalId}`,
    });

    expect(result.ok).toBe(true);
    expect(client.rpc).toHaveBeenLastCalledWith("review_trend_candidate", {
      p_candidate_id: candidateId,
      p_decision: "split",
      p_note: "근거 확인 중",
      p_public_summary: null,
      p_evidence_scope: null,
      p_evidence_links: [],
      p_target_meme_id: null,
      p_target_candidate_id: targetCandidateId,
      p_split_signal_ids: [signalId],
    });
  });

  it("canonicalizes reviewed evidence links and passes an existing meme target", async () => {
    const client = operatorClient();
    mocks.createClient.mockResolvedValue(client);

    await reviewTrendCandidate({
      ...baseInput,
      decision: "link_alias",
      targetMemeId,
      evidenceLinks: "원문 | https://youtu.be/video123?si=share&utm_source=test",
    });

    expect(client.rpc).toHaveBeenLastCalledWith("review_trend_candidate", expect.objectContaining({
      p_target_meme_id: targetMemeId,
      p_evidence_links: [{ label: "원문", url: "https://www.youtube.com/watch?v=video123" }],
    }));
  });

  it("explains when submitted evidence URLs are not the verified independent set", async () => {
    const client = operatorClient({ data: null, error: { message: "evidence_links_not_verified" } });
    mocks.createClient.mockResolvedValue(client);

    await expect(reviewTrendCandidate(baseInput)).resolves.toEqual({
      ok: false,
      error: "공개 근거 링크는 검수된 독립 사용례의 canonical URL을 3개 이상 그대로 선택해 주세요.",
    });
  });
});
