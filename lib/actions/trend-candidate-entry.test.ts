import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  configureTrendDiscoverySeed,
  submitTrendCandidateEvidence,
} from "./trend-candidate-entry";

const validCandidate = {
  candidateName: "테스트 챌린지",
  aliases: "테스트춤, 테스트 춤\n테스트춤",
  candidateKind: "new_meme",
  targetMemeId: "",
  sourceUrl: "https://www.youtube.com/watch?v=abc123&utm_source=share&si=token",
  platform: "youtube",
  platformContentId: "abc123",
  creatorKey: "channel:creator-1",
  publishedAt: "2026-10-01T12:30",
  note: "운영자가 원문 URL과 게시 시각만 확인함",
};

function operatorClient(rpcResult = { data: "saved-id", error: null }) {
  const rpc = vi.fn(async (name: string) =>
    name === "is_operator" ? { data: true, error: null } : rpcResult,
  );
  return {
    rpc,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "operator-1" } } })) },
  };
}

describe("submitTrendCandidateEvidence", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it.each([
    "http://example.com/post/1",
    "https://localhost/post/1",
    "https://127.0.0.1/post/1",
    "https://10.1.2.3/post/1",
    "https://192.168.1.8/post/1",
    "https://[::1]/post/1",
    "https://user:pass@example.com/post/1",
  ])("rejects a non-public evidence URL before authentication: %s", async (sourceUrl) => {
    const result = await submitTrendCandidateEvidence({ ...validCandidate, sourceUrl });

    expect(result).toEqual({ ok: false, error: "공개 HTTPS 원문 주소를 확인해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires a signed-in operator even when the admin form is called directly", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      rpc: vi.fn(),
    });

    await expect(submitTrendCandidateEvidence(validCandidate)).resolves.toEqual({
      ok: false,
      error: "로그인이 필요해요.",
    });
  });

  it("rejects an authenticated non-operator", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "member" } } })) },
      rpc: vi.fn(async () => ({ data: false, error: null })),
    });

    await expect(submitTrendCandidateEvidence(validCandidate)).resolves.toEqual({
      ok: false,
      error: "운영자 권한이 없어요.",
    });
  });

  it("canonicalizes one real observation and forwards unverified fields deterministically", async () => {
    const client = operatorClient();
    mocks.createClient.mockResolvedValue(client);

    const first = await submitTrendCandidateEvidence(validCandidate);
    const second = await submitTrendCandidateEvidence(validCandidate);

    expect(first).toEqual({ ok: true, message: "수동 관찰을 미검수 후보로 저장했어요." });
    expect(second).toEqual(first);
    const expected = {
      p_candidate_name: "테스트 챌린지",
      p_aliases: ["테스트춤", "테스트 춤"],
      p_candidate_kind: "new_meme",
      p_target_meme_id: null,
      p_source_url: "https://www.youtube.com/watch?v=abc123",
      p_platform: "youtube",
      p_platform_content_id: "abc123",
      p_creator_key: "channel:creator-1",
      p_published_at: "2026-10-01T03:30:00.000Z",
      p_note: "운영자가 원문 URL과 게시 시각만 확인함",
    };
    expect(client.rpc).toHaveBeenNthCalledWith(2, "submit_trend_candidate_evidence", expected);
    expect(client.rpc).toHaveBeenNthCalledWith(4, "submit_trend_candidate_evidence", expected);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/trend-candidates");
  });
});

describe("configureTrendDiscoverySeed", () => {
  it("stores a bounded keyword seed without requiring an API key", async () => {
    const client = operatorClient();
    mocks.createClient.mockResolvedValue(client);

    await expect(configureTrendDiscoverySeed({
      seedType: "term",
      seedValue: "챌린지",
      lane: "new_discovery",
      platform: "youtube",
      enabled: true,
      callBudget: 12,
    })).resolves.toEqual({ ok: true, message: "탐색 시드와 호출 예산을 저장했어요." });

    expect(client.rpc).toHaveBeenLastCalledWith("configure_trend_discovery_seed", {
      p_seed_type: "term",
      p_seed_value: "챌린지",
      p_lane: "new_discovery",
      p_platform: "youtube",
      p_enabled: true,
      p_call_budget: 12,
    });
  });

  it("requires RSS seeds to be public HTTPS URLs", async () => {
    const result = await configureTrendDiscoverySeed({
      seedType: "rss",
      seedValue: "https://192.168.0.2/feed.xml",
      lane: "new_discovery",
      platform: "",
      enabled: true,
      callBudget: 1,
    });

    expect(result).toEqual({ ok: false, error: "RSS·출처는 공개 HTTPS 주소로 입력해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
