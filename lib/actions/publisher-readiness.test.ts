import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { recordPublisherReadinessReview } from "@/lib/actions/publisher-readiness";
import { publisherReadinessFingerprint, type PublisherReadinessRow } from "@/lib/publisher-readiness";

const MEME_ID = "00000000-0000-4000-8000-000000000001";

function currentRow() {
  return {
    id: MEME_ID,
    short_id: "abc12345",
    slug: "reviewed",
    title: "검수 밈",
    summary: "검수 요약",
    description: "가".repeat(420),
    origin: "나".repeat(80),
    usage_note: "다".repeat(60),
    caution: "라".repeat(50),
    usage_examples: [],
    moderation_status: "approved",
    published_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    safety_level: "safe",
    safety_reviewed_at: "2026-09-20T00:00:00.000Z",
    house_rights_attested_at: null,
    meme_sources: [],
    meme_contents: [],
    meme_tags_map: [],
  };
}

function sessionClient(options: { operator?: boolean; row?: unknown } = {}) {
  const single = vi.fn().mockResolvedValue({
    data: options.row ?? currentRow(),
    error: null,
  });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single,
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "operator" } } }) },
    rpc: vi.fn().mockResolvedValue({ data: options.operator ?? true, error: null }),
    from: vi.fn(() => query),
    query,
  };
}

const checklist = {
  meaningContext: true,
  sourceClaims: true,
  rightsDelivery: true,
  safetyContext: true,
  ownHumanValue: true,
};

describe("recordPublisherReadinessReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects incomplete human checklists before authentication or writes", async () => {
    const result = await recordPublisherReadinessReview({
      memeId: MEME_ID,
      expectedFingerprint: "0".repeat(64),
      checklist: { ...checklist, ownHumanValue: false },
      note: "직접 검토한 근거입니다.",
    });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("모든 확인") });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rechecks operator access, rereads the current row, and stores only a bounded audit detail", async () => {
    const client = sessionClient();
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const result = await recordPublisherReadinessReview({
      memeId: MEME_ID,
      expectedFingerprint: publisherReadinessFingerprint(currentRow() as PublisherReadinessRow),
      checklist,
      note: "출처와 자체 해설을 직접 확인했습니다.",
    });

    expect(result).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("is_operator");
    expect(client.from).toHaveBeenCalledWith("memes");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: "operator",
      action: "publisher.readiness.review",
      entity_type: "meme",
      entity_id: MEME_ID,
      detail: expect.objectContaining({
        version: 1,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        checklist,
        note: "출처와 자체 해설을 직접 확인했습니다.",
      }),
    }));
    expect(JSON.stringify(insert.mock.calls[0][0])).not.toContain("description");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/publisher-readiness");
  });

  it("rejects a malformed expected fingerprint before authentication", async () => {
    const result = await recordPublisherReadinessReview({
      memeId: MEME_ID,
      expectedFingerprint: "not-a-fingerprint",
      checklist,
      note: "출처와 자체 해설을 직접 확인했습니다.",
    });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("문서 지문") });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a stale rendered fingerprint after rereading the row and writes no audit", async () => {
    const client = sessionClient();
    const insert = vi.fn();
    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const result = await recordPublisherReadinessReview({
      memeId: MEME_ID,
      expectedFingerprint: "f".repeat(64),
      checklist,
      note: "출처와 자체 해설을 직접 확인했습니다.",
    });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("변경") });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not write when authentication, authorization, or current-row loading fails", async () => {
    const client = sessionClient({ operator: false });
    const insert = vi.fn();
    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    await expect(recordPublisherReadinessReview({
      memeId: MEME_ID,
      expectedFingerprint: publisherReadinessFingerprint(currentRow() as PublisherReadinessRow),
      checklist,
      note: "직접 확인한 근거입니다.",
    })).resolves.toEqual({ ok: false, error: "운영자 권한이 없어요." });
    expect(insert).not.toHaveBeenCalled();
  });
});
