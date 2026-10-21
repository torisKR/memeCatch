import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { reviewMemeSource } from "./admin-sources";

const memeId = "20000000-0000-4000-8000-000000000002";
const sourceId = "30000000-0000-4000-8000-000000000003";
const unavailable = {
  ok: false,
  error: "원자적 출처 검수 기능이 아직 활성화되지 않았어요. 후보는 대기 상태로 유지됩니다.",
};
let client: {
  auth: { getUser: () => Promise<{ data: { user: { id: string } } }> };
  rpc: typeof mocks.rpc;
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SOURCE_REVIEW_ATOMIC_ENABLED;
  mocks.rpc.mockImplementation(async function (this: unknown, name: string) {
    if (this !== client) return { data: null, error: { message: "rpc_receiver_missing" } };
    if (name === "is_operator") return { data: true, error: null };
    if (name === "review_meme_source_atomic") return { data: {}, error: null };
    throw new Error(`unexpected rpc ${name}`);
  });
  client = {
    auth: { getUser: async () => ({ data: { user: { id: "10000000-0000-4000-8000-000000000001" } } }) },
    rpc: mocks.rpc,
  };
  mocks.createClient.mockResolvedValue(client);
});

describe("reviewMemeSource atomic review gate", () => {
  it("keeps every decision pending while the deployment gate is disabled", async () => {
    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "approve",
      sourceRole: "usage_example",
      rightsBasis: "official_embed",
    })).resolves.toEqual(unavailable);
    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "reject",
      note: "밈 사용례가 아니에요.",
    })).resolves.toEqual(unavailable);

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses one atomic RPC for an approval and refreshes public caches afterward", async () => {
    process.env.SOURCE_REVIEW_ATOMIC_ENABLED = "true";

    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "approve",
      sourceRole: "usage_example",
      rightsBasis: "official_embed",
      note: "  실제 독립 사용례 확인  ",
    })).resolves.toEqual({ ok: true });

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "is_operator");
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "review_meme_source_atomic", {
      p_meme_id: memeId,
      p_source_id: sourceId,
      p_decision: "approve",
      p_source_role: "usage_example",
      p_rights_basis: "official_embed",
      p_note: "실제 독립 사용례 확인",
    });
    expect(mocks.rpc.mock.instances[1]).toBe(client);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/sources");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("uses the same atomic RPC for rejection without public cache churn", async () => {
    process.env.SOURCE_REVIEW_ATOMIC_ENABLED = "true";

    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "reject",
      note: "밈 사용례가 아니에요.",
    })).resolves.toEqual({ ok: true });

    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "review_meme_source_atomic", {
      p_meme_id: memeId,
      p_source_id: sourceId,
      p_decision: "reject",
      p_source_role: null,
      p_rights_basis: null,
      p_note: "밈 사용례가 아니에요.",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/sources");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/global");
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects unsafe approval inputs before authentication or mutation", async () => {
    process.env.SOURCE_REVIEW_ATOMIC_ENABLED = "true";

    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "approve",
      sourceRole: "original",
      rightsBasis: "link_only",
    })).resolves.toEqual({
      ok: false,
      error: "링크만 허용된 출처를 원본으로 표시할 수 없어요. 최초 확인 출처로 승인해 주세요.",
    });
    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "approve",
      sourceRole: "usage_example",
      rightsBasis: "unknown",
    })).resolves.toEqual({
      ok: false,
      error: "권리가 확인되지 않은 출처는 승인할 수 없어요. 링크만 허용하거나 반려해 주세요.",
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not invalidate caches when the transaction fails", async () => {
    process.env.SOURCE_REVIEW_ATOMIC_ENABLED = "true";
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "is_operator") return { data: true, error: null };
      return { data: null, error: { message: "media_source_metadata_stale" } };
    });

    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "approve",
      sourceRole: "usage_example",
      rightsBasis: "official_embed",
    })).resolves.toEqual({ ok: false, error: "media_source_metadata_stale" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers and blank rejection notes before authentication", async () => {
    process.env.SOURCE_REVIEW_ATOMIC_ENABLED = "true";

    await expect(reviewMemeSource({
      memeId: "not-a-uuid",
      sourceId,
      decision: "reject",
      note: "reason",
    })).resolves.toEqual({ ok: false, error: "검수 대상을 찾을 수 없어요." });
    await expect(reviewMemeSource({
      memeId,
      sourceId,
      decision: "reject",
      note: "   ",
    })).resolves.toEqual({ ok: false, error: "반려 사유를 입력해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
