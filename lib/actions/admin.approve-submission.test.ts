import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  auditInsert: vi.fn(),
  after: vi.fn<(callback: () => void) => void>(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  getOEmbed: vi.fn(),
  isSupportedOEmbedUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/oembed", () => ({
  getOEmbed: mocks.getOEmbed,
  isSupportedOEmbedUrl: mocks.isSupportedOEmbedUrl,
}));

import { approveSubmission } from "./admin";

const submissionId = "10000000-0000-4000-8000-000000000001";
const memeId = "20000000-0000-4000-8000-000000000002";
const operatorId = "30000000-0000-4000-8000-000000000003";
const sourceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const input: Parameters<typeof approveSubmission>[0] = {
  submissionId,
  title: "테스트 밈",
  summary: "검수한 요약",
  description: "설명",
  origin: "기원",
  safetyLevel: "yellow",
  category: "phrase",
  difficulty: "normal",
  originYear: 2026,
  tags: ["테스트"],
  usageContext: { work: "yellow", friends: "green", family: "yellow", sns: "yellow" },
};

function fixture(options: {
  status?: "pending" | "reviewing" | "approved" | "rejected";
  sourceUrl?: string | null;
  user?: { id: string } | null;
  isOperator?: boolean;
} = {}) {
  const events: string[] = [];
  const state = { submissionStatus: options.status ?? "pending", moderationStatus: "pending" };
  const memeInsert = vi.fn(() => ({
    select: () => ({
      single: async () => {
        events.push("meme.insert");
        return { data: { id: memeId, short_id: "abcd1234", slug: "테스트-밈" }, error: null };
      },
    }),
  }));
  const memeUpdate = vi.fn((row: { moderation_status: string }) => ({
    eq: async () => {
      events.push(`meme.${row.moderation_status}`);
      state.moderationStatus = row.moderation_status;
      return { error: null } as { error: { message: string } | null };
    },
  }));
  const sourceInsert = vi.fn(async () => {
    events.push("source.insert");
    return { error: null } as { error: { message: string } | null };
  });
  const contentInsert = vi.fn(async () => {
    events.push("content.insert");
    return { error: null };
  });
  const submissionWrite = vi.fn(async () => {
    events.push("submission.approved");
    state.submissionStatus = "approved";
    return { data: { id: submissionId }, error: null } as {
      data: { id: string } | null;
      error: { message: string } | null;
    };
  });
  const submissionUpdate = vi.fn(() => ({
    eq: () => ({
      select: () => ({ maybeSingle: submissionWrite }),
    }),
  }));
  const tagUpsert = vi.fn(async () => {
    events.push("tag.upsert");
    return { error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === "meme_submissions") return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: submissionId,
              status: state.submissionStatus,
              submitter_id: operatorId,
              source_url: options.sourceUrl === undefined ? sourceUrl : options.sourceUrl,
            },
            error: null,
          }),
        }),
      }),
      update: submissionUpdate,
    };
    if (table === "memes") return { insert: memeInsert, update: memeUpdate };
    if (table === "meme_sources") return { insert: sourceInsert };
    if (table === "meme_contents") return { insert: contentInsert };
    if (table === "tags") return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "tag-1" } }) }) }),
    };
    if (table === "meme_tags_map") return { upsert: tagUpsert };
    throw new Error(`unexpected table ${table}`);
  });
  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: options.user === undefined ? { id: operatorId } : options.user },
      }),
    },
    rpc: async () => ({ data: options.isOperator ?? true }),
    from,
  });
  return {
    events, state, from, memeInsert, memeUpdate, sourceInsert,
    contentInsert, submissionUpdate, submissionWrite, tagUpsert,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auditInsert.mockResolvedValue({ error: null });
  mocks.createAdminClient.mockReturnValue({
    from: () => ({ insert: mocks.auditInsert }),
  });
  mocks.isSupportedOEmbedUrl.mockReturnValue(true);
  mocks.getOEmbed.mockResolvedValue({
    provider: "youtube", contentId: "dQw4w9WgXcQ", sourceUrl, title: "영상",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function runDeferredRevalidation() {
  expect(mocks.after).toHaveBeenCalledTimes(1);
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
  expect(mocks.revalidateTag).not.toHaveBeenCalled();
  const callback = mocks.after.mock.calls[0]?.[0];
  if (!callback) throw new Error("missing after callback");
  callback();
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/submissions");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/memes");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
}

describe("approveSubmission source durability", () => {
  it.each(["approved", "rejected"] as const)("does not recreate a %s submission", async (status) => {
    const f = fixture({ status });
    await expect(approveSubmission(input)).resolves.toEqual({
      ok: false, error: "이미 처리된 제보예요. 제보와 밈 관리에서 처리 결과를 확인해 주세요.",
    });
    expect(f.memeInsert).not.toHaveBeenCalled();
    expect(f.sourceInsert).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    { user: null, error: "로그인이 필요해요." },
    { isOperator: false, error: "운영자 권한이 없어요." },
  ])("requires an operator before reading or inserting", async ({ error, ...options }) => {
    const f = fixture(options);
    await expect(approveSubmission(input)).resolves.toEqual({ ok: false, error });
    expect(f.from).not.toHaveBeenCalled();
  });

  it("keeps the newly created meme pending when its source insert fails", async () => {
    const f = fixture();
    f.sourceInsert.mockResolvedValueOnce({ error: { message: "private database detail" } });
    const result = await approveSubmission(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a source error");
    expect(result.createdMemeId).toBe(memeId);
    expect(result.error).toContain("출처 저장에 실패");
    expect(result.error).toContain(memeId);
    expect(result.error).toContain("다시 실행하지 말고");
    expect(result.error).not.toContain("private database detail");
    expect(f.memeInsert).toHaveBeenCalledWith(expect.objectContaining({ moderation_status: "pending" }));
    expect(f.state.moderationStatus).toBe("pending");
    expect(f.events).toEqual(["meme.insert"]);
    expect(f.memeUpdate).not.toHaveBeenCalled();
    expect(f.contentInsert).not.toHaveBeenCalled();
    expect(mocks.getOEmbed).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalledWith("tags");
    expect(f.submissionUpdate).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("returns the pending meme recovery ID when source transport throws", async () => {
    const f = fixture();
    f.sourceInsert.mockRejectedValueOnce(new Error("private transport detail"));
    const result = await approveSubmission(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a source error");
    expect(result.createdMemeId).toBe(memeId);
    expect(result.error).toContain(memeId);
    expect(result.error).not.toContain("private transport detail");
    expect(f.memeUpdate).not.toHaveBeenCalled();
    expect(f.submissionUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["pending", "reviewing"] as const)("stores source before publishing a %s submission", async (status) => {
    const f = fixture({ status });
    await expect(approveSubmission(input)).resolves.toEqual({ ok: true, data: { memeId } });
    expect(mocks.after).not.toHaveBeenCalled();
    expect(f.events).toEqual([
      "meme.insert", "source.insert", "meme.fact_checking",
      "meme.rights_checking", "meme.approved", "content.insert",
      "tag.upsert", "submission.approved",
    ]);
    expect(f.sourceInsert).toHaveBeenCalledWith({
      meme_id: memeId, platform: "youtube.com", source_url: sourceUrl,
    });
    expect(f.sourceInsert).not.toHaveBeenCalledWith(expect.objectContaining({
      copyright_status: "owned",
    }));
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "submission.approve",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");

    const repeated = await approveSubmission(input);
    expect(repeated.ok).toBe(false);
    expect(f.memeInsert).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing optional-source contract", async () => {
    const f = fixture({ sourceUrl: null });
    await expect(approveSubmission(input)).resolves.toEqual({ ok: true, data: { memeId } });
    expect(f.sourceInsert).not.toHaveBeenCalled();
    expect(f.memeUpdate).toHaveBeenCalledTimes(3);
    expect(mocks.getOEmbed).not.toHaveBeenCalled();
  });

  it("does not run later transitions or publication side effects after a transition error", async () => {
    const f = fixture();
    f.memeUpdate.mockImplementationOnce(() => ({
      eq: async () => ({ error: { message: "transition failed" } }),
    }));
    const result = await approveSubmission(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a transition error");
    expect(result.createdMemeId).toBe(memeId);
    expect(f.sourceInsert).toHaveBeenCalledTimes(1);
    expect(f.memeUpdate).toHaveBeenCalledTimes(1);
    expect(f.contentInsert).not.toHaveBeenCalled();
    expect(f.submissionUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the created meme recovery ID when transition transport throws", async () => {
    const f = fixture();
    f.memeUpdate.mockImplementationOnce(() => ({
      eq: async () => { throw new Error("private transport detail"); },
    }));
    const result = await approveSubmission(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a transition error");
    expect(result.createdMemeId).toBe(memeId);
    expect(result.error).toContain("fact_checking");
    expect(result.error).toContain("다시 승인하지 말고");
    expect(result.error).not.toContain("private transport detail");
    expect(f.memeUpdate).toHaveBeenCalledTimes(1);
    expect(f.contentInsert).not.toHaveBeenCalled();
    expect(f.submissionUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not report a created meme for ordinary input validation failure", async () => {
    const f = fixture();
    await expect(approveSubmission({ ...input, title: "" })).resolves.toEqual({
      ok: false, error: "제목을 입력해 주세요.",
    });
    expect(f.from).not.toHaveBeenCalled();
    expect(f.memeInsert).not.toHaveBeenCalled();
  });

  it("returns publication success with recovery warning when submission status storage fails", async () => {
    const telemetry = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const f = fixture();
    f.submissionWrite.mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
    const result = await approveSubmission(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data?.memeId).toBe(memeId);
    expect(result.data?.warning).toContain("제보 상태 저장");
    expect(result.data?.warning).toContain("다시 승인하지 말고");
    expect(result.data?.warning).toContain(submissionId);
    expect(result.data?.warning).not.toContain("private database detail");
    runDeferredRevalidation();
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(`/admin/submissions/${submissionId}`);
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ meme_id: memeId, submission_status_update_pending: true }),
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");
    expect(telemetry).toHaveBeenCalledWith({
      event: "submission_approval_reconciliation_pending",
      submission_id: submissionId, meme_id: memeId, step: "submission_status",
    });
  });

  it.each(["empty", "throw"] as const)("warns on a %s submission update outcome after publication", async (outcome) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const f = fixture();
    if (outcome === "empty") f.submissionWrite.mockResolvedValueOnce({ data: null, error: null });
    else f.submissionWrite.mockRejectedValueOnce(new Error("private transport detail"));
    const result = await approveSubmission(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data?.warning).toContain("제보 상태 저장");
    runDeferredRevalidation();
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(`/admin/submissions/${submissionId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");
  });

  it("keeps publication success when a deferred cache refresh throws", async () => {
    const telemetry = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixture();
    mocks.auditInsert.mockResolvedValueOnce({ error: { message: "private audit detail" } });
    const result = await approveSubmission(input);
    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error("private cache detail"); });
    const callback = mocks.after.mock.calls[0]?.[0];
    if (!callback) throw new Error("missing after callback");
    expect(() => callback()).not.toThrow();
    expect(telemetry).toHaveBeenCalledWith({ event: "submission_approval_cache_revalidation_pending" });
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("private cache detail");
    expect(result.ok).toBe(true);
  });

  it("keeps the warning result when after scheduling is unavailable", async () => {
    const telemetry = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixture();
    mocks.auditInsert.mockResolvedValueOnce({ error: { message: "private audit detail" } });
    mocks.after.mockImplementationOnce(() => { throw new Error("private scheduler detail"); });
    const result = await approveSubmission(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.warning).toContain("감사 기록 저장");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith({ event: "submission_approval_cache_revalidation_pending" });
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("private scheduler detail");
  });

  it("does not report public creation as failed when the completion audit cannot be stored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixture();
    mocks.auditInsert.mockResolvedValueOnce({ error: { message: "private audit detail" } });
    const result = await approveSubmission(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data?.memeId).toBe(memeId);
    expect(result.data?.warning).toContain("감사 기록 저장");
    expect(result.data?.warning).toContain("다시 승인하지 말고");
    expect(result.data?.warning).not.toContain("private audit detail");
    runDeferredRevalidation();
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(`/admin/submissions/${submissionId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");
  });
});
