import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createClient, getOpenAiReviewModel, revalidatePath, requestOpenAiStructured } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getOpenAiReviewModel: vi.fn(() => "gpt-5.6-sol"),
  revalidatePath: vi.fn(),
  requestOpenAiStructured: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/openai-review.server", () => ({
  getOpenAiReviewModel,
  OPENAI_REVIEW_REASONING_EFFORT: "high",
  requestOpenAiStructured,
}));

import {
  deleteMemeTranslation,
  claimTranslationPriority,
  listMissingMemeTranslations,
  listTranslationPriorityQueue,
  listTranslationsForReview,
  markMemeTranslationStale,
  previewMissingMemeTranslationWithGpt,
  reviewMemeTranslation,
  reviewMemeTranslationWithGpt,
  saveMissingMemeTranslationDraft,
  saveMemeTranslation,
  getTranslationCoverage,
  listTranslationSupplyPriorityQueue,
  type TranslationReviewInput,
} from "@/lib/actions/admin-translations";

const SOURCE_UPDATED_AT = "2026-07-28T01:00:00.000Z";
const EXPECTED_UPDATED_AT = "2026-07-28T01:05:00.000Z";
const PREVIEW_MEME_ID = "00000000-0000-4000-8000-000000000001";

function query(result: { data: unknown; error: { message: string } | null; count?: number }) {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    overrideTypes: vi.fn(),
    insert: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // 목록 조회는 terminal 메서드 없이 체이닝 끝에서 바로 await되므로 thenable로 만든다
    // (실제 supabase-js PostgrestFilterBuilder와 동일한 계약).
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  builder.select.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  builder.overrideTypes.mockReturnValue(builder);
  builder.maybeSingle.mockReturnValue(builder);
  return builder;
}

function operatorClient(
  tableQueries: Record<string, ReturnType<typeof query>[]>,
  rpc = vi.fn(),
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "operator-1" } } }),
    },
    from: vi.fn((table: string) => {
      const next = tableQueries[table]?.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    }),
    rpc,
  };
}

function actionInput(): TranslationReviewInput {
  return {
    memeId: "meme-1",
    locale: "en",
    expectedTranslationUpdatedAt: EXPECTED_UPDATED_AT,
    title: "Localized title",
    summary: "Localized summary",
    description: "Localized description",
    origin: "Localized origin",
    usageNote: "Localized usage",
    caution: "Localized caution",
    aliases: ["Alias"],
  };
}

function contextQueries() {
  return {
    profile: query({ data: { role: "operator" }, error: null }),
    meme: query({
      data: {
        id: "meme-1",
        short_id: "abc123",
        slug: "source-slug",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    }),
    translation: query({
      data: {
        meme_id: "meme-1",
        locale: "en",
        localized_slug: "localized-slug",
        source_updated_at: SOURCE_UPDATED_AT,
        updated_at: EXPECTED_UPDATED_AT,
        status: "machine",
      },
      error: null,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin translation concurrency and audit", () => {
  it("saves only the translation revision rendered by the operator and audits with their client", async () => {
    const context = contextQueries();
    const mutation = query({ data: { meme_id: "meme-1" }, error: null });
    const audit = query({ data: null, error: null });
    const supabase = operatorClient({
      profiles: [context.profile],
      memes: [context.meme],
      meme_translations: [context.translation, mutation],
      admin_audit_log: [audit],
    });
    createClient.mockResolvedValue(supabase);

    await expect(saveMemeTranslation(actionInput())).resolves.toEqual({ ok: true });

    expect(mutation.eq).toHaveBeenCalledWith("updated_at", EXPECTED_UPDATED_AT);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "operator-1",
        action: "meme_translation.save",
      }),
    );
  });

  it("CAS-guards source-change recovery, audits the recovery, and revalidates", async () => {
    const context = contextQueries();
    const reviewedUpdatedAt = "2026-07-28T01:06:00.000Z";
    const reviewMutation = query({
      data: { meme_id: "meme-1", updated_at: reviewedUpdatedAt },
      error: null,
    });
    const latestMeme = query({
      data: { updated_at: "2026-07-28T02:00:00.000Z" },
      error: null,
    });
    const recovery = query({ data: { meme_id: "meme-1" }, error: null });
    const audit = query({ data: null, error: null });
    const supabase = operatorClient({
      profiles: [context.profile],
      memes: [context.meme, latestMeme],
      meme_translations: [context.translation, reviewMutation, recovery],
      admin_audit_log: [audit],
    });
    createClient.mockResolvedValue(supabase);

    const result = await reviewMemeTranslation(actionInput());

    expect(result).toEqual({
      ok: false,
      error: "검수 도중 한국어 원문이 변경되어 번역을 stale 상태로 되돌렸어요.",
    });
    expect(reviewMutation.eq).toHaveBeenCalledWith("updated_at", EXPECTED_UPDATED_AT);
    expect(recovery.update).toHaveBeenCalledWith({
      status: "stale",
      reviewed_at: null,
      reviewed_by: null,
    });
    expect(recovery.eq).toHaveBeenCalledWith("updated_at", reviewedUpdatedAt);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meme_translation.review_source_changed" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/memes/meme-1");
  });

  it("returns an audit error instead of silently succeeding", async () => {
    const context = contextQueries();
    const mutation = query({ data: { meme_id: "meme-1" }, error: null });
    const audit = query({ data: null, error: { message: "RLS rejected insert" } });
    const supabase = operatorClient({
      profiles: [context.profile],
      memes: [context.meme],
      meme_translations: [context.translation, mutation],
      admin_audit_log: [audit],
    });
    createClient.mockResolvedValue(supabase);

    const result = await markMemeTranslationStale({
      memeId: "meme-1",
      locale: "en",
      expectedTranslationUpdatedAt: EXPECTED_UPDATED_AT,
    });

    expect(mutation.eq).toHaveBeenCalledWith("updated_at", EXPECTED_UPDATED_AT);
    expect(result).toEqual({
      ok: false,
      error: "감사 로그를 기록하지 못했어요: RLS rejected insert",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/memes/meme-1");
  });
});

describe("translation coverage desk", () => {
  it("counts only public memes, separates revision states, and stays read-only", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const memes = query({
      data: [
        { id: "meme-1", updated_at: SOURCE_UPDATED_AT },
        { id: "meme-2", updated_at: "2026-07-28T02:00:00.000Z" },
      ],
      error: null,
    });
    const translations = query({
      data: [
        { meme_id: "meme-1", locale: "en", status: "reviewed", source_updated_at: SOURCE_UPDATED_AT },
        { meme_id: "meme-2", locale: "ja", status: "machine", source_updated_at: "2026-07-28T02:00:00.000Z" },
        { meme_id: "meme-1", locale: "zh", status: "reviewed", source_updated_at: "2026-07-27T02:00:00.000Z" },
        { meme_id: "private-meme", locale: "en", status: "reviewed", source_updated_at: SOURCE_UPDATED_AT },
      ],
      error: null,
    });
    const supabase = operatorClient({ profiles: [profile], memes: [memes], meme_translations: [translations] });
    createClient.mockResolvedValue(supabase);

    await expect(getTranslationCoverage()).resolves.toEqual({
      ok: true,
      data: [
        { locale: "en", totalPublic: 2, reviewedCurrent: 1, reviewNeeded: 0, stale: 0, missing: 1, completionPercentage: 50 },
        { locale: "ja", totalPublic: 2, reviewedCurrent: 0, reviewNeeded: 1, stale: 0, missing: 1, completionPercentage: 0 },
        { locale: "zh", totalPublic: 2, reviewedCurrent: 0, reviewNeeded: 0, stale: 1, missing: 1, completionPercentage: 0 },
        { locale: "zh-tw", totalPublic: 2, reviewedCurrent: 0, reviewNeeded: 0, stale: 0, missing: 2, completionPercentage: 0 },
      ],
    });
    expect(memes.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(translations.in).toHaveBeenCalledWith("memes.moderation_status", ["approved", "limited"]);
    expect(memes.update).not.toHaveBeenCalled();
    expect(memes.delete).not.toHaveBeenCalled();
    expect(translations.update).not.toHaveBeenCalled();
    expect(translations.delete).not.toHaveBeenCalled();
  });

  it("does not turn a query failure or non-operator session into zero coverage", async () => {
    const profile = query({ data: { role: "member" }, error: null });
    const supabase = operatorClient({ profiles: [profile] });
    createClient.mockResolvedValue(supabase);

    await expect(getTranslationCoverage()).resolves.toEqual({ ok: false, error: "운영자 권한이 없어요." });
  });
});

describe("missing translation draft preview", () => {
  it("rejects a non-operator before listing missing translations", async () => {
    const profile = query({ data: { role: "member" }, error: null });
    const supabase = operatorClient({ profiles: [profile] });
    createClient.mockResolvedValue(supabase);

    await expect(listMissingMemeTranslations({ locale: "en" })).resolves.toEqual({
      ok: false,
      error: "운영자 권한이 없어요.",
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(requestOpenAiStructured).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("pages beyond 1000 rows, excludes existing translations, filters public sources, and clamps the limit", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const translatedRows = Array.from({ length: 1000 }, (_, index) => ({
      meme_id: `existing-${index}`,
    }));
    const translatedPage = query({ data: translatedRows, error: null });
    const translatedEnd = query({ data: [], error: null });
    const publicPage = query({
      data: translatedRows.map((row, index) => ({
        id: row.meme_id,
        short_id: `short-${index}`,
        title: `기존 ${index}`,
        summary: "요약",
        description: "설명",
        origin: "유래",
        usage_note: null,
        caution: null,
        aliases: [],
        updated_at: SOURCE_UPDATED_AT,
      })),
      error: null,
    });
    const missingPage = query({
      data: Array.from({ length: 120 }, (_, index) => ({
        id: `missing-${index}`,
        short_id: `missing-short-${index}`,
        title: `미번역 ${index}`,
        summary: "원문 요약",
        description: "원문 설명",
        origin: "원문 유래",
        usage_note: "사용 맥락",
        caution: "주의",
        aliases: ["별칭"],
        updated_at: SOURCE_UPDATED_AT,
      })),
      error: null,
    });
    const rpc = vi.fn();
    const supabase = operatorClient(
      {
        profiles: [profile],
        meme_translations: [translatedPage, translatedEnd],
        memes: [publicPage, missingPage],
      },
      rpc,
    );
    createClient.mockResolvedValue(supabase);

    const result = await listMissingMemeTranslations({ locale: "en", limit: 500 });

    expect(result).toEqual({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          memeId: "missing-0",
          shortId: "missing-short-0",
          title: "미번역 0",
          updatedAt: SOURCE_UPDATED_AT,
        }),
      ]),
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.data).toHaveLength(100);
    expect(translatedPage.eq).toHaveBeenCalledWith("locale", "en");
    expect(translatedPage.range).toHaveBeenCalledWith(0, 999);
    expect(translatedEnd.range).toHaveBeenCalledWith(1000, 1999);
    expect(publicPage.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(publicPage.range).toHaveBeenCalledWith(0, 999);
    expect(missingPage.range).toHaveBeenCalledWith(1000, 1999);
    for (const read of [profile, translatedPage, translatedEnd, publicPage, missingPage]) {
      expect(read.insert).not.toHaveBeenCalled();
      expect(read.update).not.toHaveBeenCalled();
      expect(read.delete).not.toHaveBeenCalled();
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalledWith("admin_audit_log");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("prioritizes missing rows whose source can unlock an indexable locale route", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const translated = query({ data: [], error: null });
    const sourceFields = {
      description: "가".repeat(160),
      origin: "나".repeat(30),
      usage_note: "다".repeat(40),
      caution: "라".repeat(40),
      aliases: [],
      usage_examples: [
        { situation: "친구", text: "마" },
        { situation: "댓글", text: "바" },
      ],
      meme_sources: [{ source_url: "https://example.com/source" }],
      meme_contents: [{ availability: "live", moderation_status: "approved" }],
      meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    };
    const sources = query({
      data: [
        {
          id: "thin-new",
          short_id: "thin-new",
          title: "얇은 최신 원문",
          summary: "요약",
          ...sourceFields,
          description: "짧은 원문",
          origin: "",
          usage_note: null,
          caution: null,
          usage_examples: [],
          meme_sources: [],
          meme_contents: [],
          meme_tags_map: [],
          updated_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "ready-old",
          short_id: "ready-old",
          title: "충실한 오래된 원문",
          summary: "요약",
          ...sourceFields,
          updated_at: "2026-08-08T00:00:00.000Z",
        },
        {
          id: "ready-new",
          short_id: "ready-new",
          title: "충실한 최신 원문",
          summary: "요약",
          ...sourceFields,
          updated_at: "2026-08-09T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const supabase = operatorClient({ profiles: [profile], meme_translations: [translated], memes: [sources] });
    createClient.mockResolvedValue(supabase);

    const result = await listMissingMemeTranslations({ locale: "en", limit: 3 });

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({ memeId: "ready-new", routeUnlockCandidate: true }),
        expect.objectContaining({ memeId: "ready-old", routeUnlockCandidate: true }),
        expect.objectContaining({ memeId: "thin-new", routeUnlockCandidate: false }),
      ],
    });
    expect(sources.select).toHaveBeenCalledWith(expect.stringContaining("meme_contents(availability, moderation_status)"));
  });

  it("puts validated Plus-priority rows before route-unlock rows within the fixed batch", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const translated = query({ data: [], error: null });
    const priorityMemeId = "00000000-0000-4000-8000-000000000001";
    const routeUnlockMemeId = "00000000-0000-4000-8000-000000000002";
    const deepFields = {
      description: "가".repeat(160),
      origin: "나".repeat(30),
      usage_note: "다".repeat(40),
      caution: "라".repeat(40),
      aliases: [],
      usage_examples: [{ situation: "친구", text: "마" }],
      meme_sources: [{ source_url: "https://example.com/source" }],
      meme_contents: [{ availability: "live", moderation_status: "approved" }],
      meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    };
    const sources = query({
      data: [
        {
          id: routeUnlockMemeId,
          short_id: "route-unlock",
          title: "글로벌 공개 후보",
          summary: "요약",
          ...deepFields,
          updated_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: priorityMemeId,
          short_id: "plus-priority",
          title: "Plus 요청 원문",
          summary: "요약",
          description: "짧은 원문",
          origin: "",
          usage_note: null,
          caution: null,
          aliases: [],
          usage_examples: [],
          meme_sources: [],
          meme_contents: [],
          meme_tags_map: [],
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const supabase = operatorClient({
      profiles: [profile],
      meme_translations: [translated],
      memes: [sources],
    });
    createClient.mockResolvedValue(supabase);

    const result = await listMissingMemeTranslations({
      locale: "zh",
      limit: 1,
      priorityMemeIds: [priorityMemeId],
    });

    expect(result).toEqual({
      ok: true,
      data: [expect.objectContaining({ memeId: priorityMemeId, routeUnlockCandidate: false })],
    });
  });

  it("fails closed before querying when a Plus-priority meme ID is invalid", async () => {
    await expect(
      listMissingMemeTranslations({ locale: "zh", priorityMemeIds: ["not-a-uuid"] }),
    ).resolves.toEqual({ ok: false, error: "번역 우선순위 밈 ID가 올바르지 않아요." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("keeps the focused Plus request visible when higher-ranked rows exceed the limit", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const translated = query({ data: [], error: null });
    const focusedMemeId = "00000000-0000-4000-8000-000000000099";
    const sourceFields = {
      description: "가".repeat(160),
      origin: "나".repeat(30),
      usage_note: "다".repeat(40),
      caution: "라".repeat(40),
      aliases: [],
      usage_examples: [{ situation: "친구", text: "마" }],
      meme_sources: [{ source_url: "https://example.com/source" }],
      meme_contents: [{ availability: "live", moderation_status: "approved" }],
      meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    };
    const focused = query({
      data: {
        id: focusedMemeId,
        short_id: "focused-thin",
        title: "집중할 얇은 원문",
        summary: "요약",
        ...sourceFields,
        description: "짧은 원문",
        origin: "",
        usage_note: null,
        caution: null,
        usage_examples: [],
        meme_sources: [],
        meme_contents: [],
        meme_tags_map: [],
        updated_at: "2026-08-01T00:00:00.000Z",
      },
      error: null,
    });
    const higherRankedRows = query({
      data: Array.from({ length: 21 }, (_, index) => ({
        id: `ready-${String(index).padStart(2, "0")}`,
        short_id: `ready-${String(index).padStart(2, "0")}`,
        title: `충실한 원문 ${index}`,
        summary: "요약",
        ...sourceFields,
        updated_at: "2026-08-20T00:00:00.000Z",
      })),
      error: null,
    });
    const supabase = operatorClient({
      profiles: [profile],
      meme_translations: [translated],
      memes: [focused, higherRankedRows],
    });
    createClient.mockResolvedValue(supabase);

    const result = await listMissingMemeTranslations({
      locale: "en",
      limit: 20,
      focusMemeId: focusedMemeId,
    });

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({ memeId: focusedMemeId, routeUnlockCandidate: false }),
        ...Array.from({ length: 19 }, (_, index) =>
          expect.objectContaining({ memeId: `ready-${String(index).padStart(2, "0")}` }),
        ),
      ],
    });
    expect(result.ok && result.data[0]?.memeId).toBe(focusedMemeId);
  });

  it("rejects a preview when a translation row already exists", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const source = query({
      data: {
        id: PREVIEW_MEME_ID,
        short_id: "abc123",
        title: "원문 제목",
        summary: "원문 요약",
        description: "원문 설명",
        origin: "원문 유래",
        usage_note: null,
        caution: null,
        aliases: [],
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });
    const existing = query({ data: { meme_id: PREVIEW_MEME_ID }, error: null });
    const supabase = operatorClient({
      profiles: [profile],
      memes: [source],
      meme_translations: [existing],
    });
    createClient.mockResolvedValue(supabase);

    await expect(
      previewMissingMemeTranslationWithGpt({
        memeId: PREVIEW_MEME_ID,
        locale: "en",
        expectedSourceUpdatedAt: SOURCE_UPDATED_AT,
      }),
    ).resolves.toEqual({ ok: false, error: "이미 해당 언어의 번역 행이 있어요." });
    expect(source.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(requestOpenAiStructured).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a source-only GPT preview with the required schema, model, and high reasoning contract without writes", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const source = query({
      data: {
        id: PREVIEW_MEME_ID,
        short_id: "abc123",
        title: "원문 제목",
        summary: "불확실한 원문 요약",
        description: "원문 설명",
        origin: "출처가 확실하지 않음",
        usage_note: "원문 사용법",
        caution: "원문 주의",
        aliases: ["원문 별칭"],
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });
    const existing = query({ data: null, error: null });
    const latestSource = query({ data: { updated_at: SOURCE_UPDATED_AT }, error: null });
    const latestTranslation = query({ data: null, error: null });
    const rpc = vi.fn();
    const supabase = operatorClient(
      {
        profiles: [profile],
        memes: [source, latestSource],
        meme_translations: [existing, latestTranslation],
      },
      rpc,
    );
    const draft = {
      title: "Preview title",
      summary: "Preview summary",
      description: "Preview description",
      origin: "Uncertain origin",
      usage_note: "Preview usage",
      caution: "Preview caution",
      aliases: ["Preview alias"],
      recommendation: "edit" as const,
      confidence: "medium" as const,
      review_notes: ["Preserved source uncertainty."],
    };
    requestOpenAiStructured.mockResolvedValue(draft);
    createClient.mockResolvedValue(supabase);

    await expect(
      previewMissingMemeTranslationWithGpt({
        memeId: PREVIEW_MEME_ID,
        locale: "en",
        expectedSourceUpdatedAt: SOURCE_UPDATED_AT,
      }),
    ).resolves.toEqual({ ok: true, data: { sourceUpdatedAt: SOURCE_UPDATED_AT, draft } });

    expect(source.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(getOpenAiReviewModel).toHaveBeenCalledTimes(1);
    expect(getOpenAiReviewModel).toHaveReturnedWith("gpt-5.6-sol");
    expect(requestOpenAiStructured).toHaveBeenCalledWith({
      name: "missing_meme_translation_preview",
      schema: expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: expect.arrayContaining([
          "title",
          "summary",
          "description",
          "origin",
          "usage_note",
          "caution",
          "aliases",
          "recommendation",
          "confidence",
          "review_notes",
        ]),
      }),
      instructions: expect.stringMatching(
        /초안 미리보기[\s\S]*원문만 사용[\s\S]*사실이나 출처를 만들지[\s\S]*불확실성[\s\S]*운영자가[\s\S]*저장하고 발행/,
      ),
      input: expect.stringContaining('"preview_only": true'),
    });
    for (const read of [profile, source, existing, latestSource, latestTranslation]) {
      expect(read.insert).not.toHaveBeenCalled();
      expect(read.update).not.toHaveBeenCalled();
      expect(read.delete).not.toHaveBeenCalled();
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalledWith("admin_audit_log");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("saves an explicitly edited machine draft with the current source revision", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const source = query({
      data: {
        id: PREVIEW_MEME_ID,
        short_id: "abc123",
        slug: "source-slug",
        updated_at: SOURCE_UPDATED_AT,
        moderation_status: "approved",
      },
      error: null,
    });
    const existing = query({ data: null, error: null });
    const mutation = query({ data: null, error: null });
    const audit = query({ data: null, error: null });
    const supabase = operatorClient({
      profiles: [profile],
      memes: [source],
      meme_translations: [existing, mutation],
      admin_audit_log: [audit],
    });
    createClient.mockResolvedValue(supabase);

    await expect(
      saveMissingMemeTranslationDraft({
        memeId: PREVIEW_MEME_ID,
        locale: "en",
        expectedSourceUpdatedAt: SOURCE_UPDATED_AT,
        title: " Edited title ",
        summary: "Edited summary",
        description: "Edited description",
        origin: "Edited origin",
        usageNote: "Edited usage",
        caution: "Edited caution",
        aliases: ["Alias", " Alias "],
      }),
    ).resolves.toEqual({ ok: true });

    expect(mutation.insert).toHaveBeenCalledWith({
      meme_id: PREVIEW_MEME_ID,
      locale: "en",
      localized_slug: "edited-title",
      title: "Edited title",
      summary: "Edited summary",
      description: "Edited description",
      origin: "Edited origin",
      usage_note: "Edited usage",
      caution: "Edited caution",
      aliases: ["Alias"],
      status: "machine",
      source_updated_at: SOURCE_UPDATED_AT,
      provider: "openai",
      model: "gpt-5.6-sol",
      prompt_version: 1,
      reviewed_at: null,
      reviewed_by: null,
    });
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "meme_translation.draft_create",
        detail: expect.objectContaining({
          status: "machine",
          auto_published: false,
          reasoning_effort: "high",
        }),
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/translations");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/memes/${PREVIEW_MEME_ID}`);
    expect(revalidatePath).not.toHaveBeenCalledWith("/sitemap.xml");
  });

  it("discards a GPT result when the source changes during the request", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const source = query({
      data: {
        id: PREVIEW_MEME_ID,
        short_id: "abc123",
        title: "원문 제목",
        summary: "원문 요약",
        description: "원문 설명",
        origin: "원문 유래",
        usage_note: null,
        caution: null,
        aliases: [],
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });
    const existing = query({ data: null, error: null });
    const latestSource = query({
      data: { updated_at: "2026-08-09T03:00:00.000Z" },
      error: null,
    });
    const latestTranslation = query({ data: null, error: null });
    const supabase = operatorClient({
      profiles: [profile],
      memes: [source, latestSource],
      meme_translations: [existing, latestTranslation],
    });
    requestOpenAiStructured.mockResolvedValue({ recommendation: "edit", confidence: "low" });
    createClient.mockResolvedValue(supabase);

    await expect(
      previewMissingMemeTranslationWithGpt({
        memeId: PREVIEW_MEME_ID,
        locale: "en",
        expectedSourceUpdatedAt: SOURCE_UPDATED_AT,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "원문 또는 번역 상태가 변경되어 초안을 폐기했어요. 새로고침해 주세요.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalledWith("admin_audit_log");
  });
});

describe("admin translation review queue", () => {
  it("fails closed before the GPT call if the administrator review contract drifts", async () => {
    const context = contextQueries();
    const profile = query({ data: { role: "operator" }, error: null });
    const source = query({
      data: {
        title: "원문 제목",
        summary: "원문 요약",
        description: "원문 설명",
        origin: "원문 유래",
        usage_note: null,
        caution: null,
        aliases: [],
      },
      error: null,
    });
    const localized = query({
      data: {
        title: "Localized title",
        summary: "Localized summary",
        description: "Localized description",
        origin: "Localized origin",
        usage_note: null,
        caution: null,
        aliases: [],
      },
      error: null,
    });
    const supabase = operatorClient({
      profiles: [profile],
      memes: [context.meme, source],
      meme_translations: [context.translation, localized],
    });
    getOpenAiReviewModel.mockImplementationOnce(() => "legacy-review-model");
    createClient.mockResolvedValue(supabase);

    await expect(
      reviewMemeTranslationWithGpt({
        memeId: "meme-1",
        locale: "en",
        expectedTranslationUpdatedAt: EXPECTED_UPDATED_AT,
      }),
    ).resolves.toEqual({ ok: false, error: "GPT 검수 AI 계약이 올바르지 않아요." });

    expect(requestOpenAiStructured).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalledWith("admin_audit_log");
  });

  it("maps the Plus demand queue and claims a requested locale through RPCs", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            meme_id: "meme-1",
            locale: "en",
            request_count: 4,
            latest_requested_at: EXPECTED_UPDATED_AT,
            status: "requested",
            meme_title: "원문 제목",
            meme_short_id: "abc123",
            meme_slug: "source-slug",
            meme_summary: "요약",
            meme_updated_at: SOURCE_UPDATED_AT,
            translation_status: null,
            translation_updated_at: null,
            source_updated_at: SOURCE_UPDATED_AT,
            translation_title: "Localized",
            translation_summary: "Localized summary",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: { status: "in_review" }, error: null });
    const source = query({
      data: [
        {
          id: "meme-1",
          short_id: "abc123",
          title: "원문 제목",
          summary: "요약",
          description: "d".repeat(160),
          origin: "o".repeat(40),
          usage_note: "u".repeat(40),
          caution: "c".repeat(40),
          aliases: [],
          updated_at: SOURCE_UPDATED_AT,
          usage_examples: [{ situation: "s", text: "t" }],
          meme_sources: [{ source_url: "https://example.com/source" }],
          meme_contents: [{ availability: "available", moderation_status: "approved" }],
          meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
        },
      ],
      error: null,
    });
    const supabase = operatorClient({ profiles: [profile, profile], memes: [source] }, rpc);
    createClient.mockResolvedValue(supabase);

    await expect(listTranslationPriorityQueue()).resolves.toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          memeId: "meme-1",
          locale: "en",
          requestCount: 4,
          status: "requested",
          routeUnlockCandidate: true,
        }),
      ],
    });
    await expect(claimTranslationPriority({ memeId: "meme-1", locale: "en" })).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenNthCalledWith(1, "list_translation_priority_queue", { p_limit: 50 });
    expect(rpc).toHaveBeenNthCalledWith(2, "claim_translation_priority_request", {
      p_meme_id: "meme-1",
      p_locale: "en",
    });
  });

  it("passes the selected locale into the priority RPC before its database limit", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    createClient.mockResolvedValue(operatorClient({ profiles: [profile] }, rpc));

    await expect(listTranslationPriorityQueue(50, "ja")).resolves.toEqual({ ok: true, data: [] });
    expect(rpc).toHaveBeenCalledWith("list_translation_priority_queue", {
      p_limit: 50,
      p_locale: "ja",
    });
  });

  it("sorts the full global supply set before applying the UI limit", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const source = (id: string, routeUnlockCandidate: boolean) => ({
      id,
      short_id: id,
      slug: id,
      title: id,
      summary: "summary",
      description: routeUnlockCandidate ? "d".repeat(160) : "thin",
      origin: routeUnlockCandidate ? "o".repeat(40) : "",
      usage_note: routeUnlockCandidate ? "u".repeat(40) : null,
      caution: routeUnlockCandidate ? "c".repeat(40) : null,
      aliases: [],
      updated_at: SOURCE_UPDATED_AT,
      usage_examples: routeUnlockCandidate ? [{ situation: "s", text: "t" }] : [],
      meme_sources: routeUnlockCandidate ? [{ source_url: "https://example.com/source" }] : [],
      meme_contents: routeUnlockCandidate
        ? [{ availability: "available", moderation_status: "approved" }]
        : [],
      meme_tags_map: routeUnlockCandidate
        ? [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }]
        : [],
      moderation_status: "approved",
    });
    const demandRows = Array.from({ length: 1001 }, (_, index) => {
      const id = index === 1000 ? "route-meme" : `thin-meme-${index}`;
      return {
        meme_id: id,
        locale: index % 2 === 0 ? "en" : "ja",
        status: "requested",
        created_at: "2026-08-10T01:00:00.000Z",
        memes: source(id, index === 1000),
      };
    });
    const demandPages = [
      query({ data: demandRows.slice(0, 1000), error: null }),
      query({ data: demandRows.slice(1000), error: null }),
    ];
    const translationPages = Array.from({ length: 6 }, () => query({ data: [], error: null }));
    createClient.mockResolvedValue(
      operatorClient(
        { profiles: [profile], plus_translation_requests: demandPages, meme_translations: translationPages },
      ),
    );

    const result = await listTranslationSupplyPriorityQueue(50);
    expect(result).toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({ memeId: "route-meme", routeUnlockCandidate: true }),
      ]),
    });
    if (result.ok) expect(result.data).toHaveLength(50);
  });

  it("returns a GPT review draft without mutating or publishing the translation", async () => {
    const context = contextQueries();
    const source = query({
      data: {
        title: "원문 제목",
        summary: "원문 요약",
        description: "원문 설명",
        origin: "원문 유래",
        usage_note: "원문 사용법",
        caution: "원문 주의",
        aliases: ["원문 별칭"],
      },
      error: null,
    });
    const localized = query({
      data: {
        title: "Localized title",
        summary: "Localized summary",
        description: "Localized description",
        origin: "Localized origin",
        usage_note: "Localized usage",
        caution: "Localized caution",
        aliases: ["Alias"],
      },
      error: null,
    });
    const audit = query({ data: null, error: null });
    const supabase = operatorClient({
      profiles: [context.profile],
      memes: [context.meme, source],
      meme_translations: [context.translation, localized],
      admin_audit_log: [audit],
    });
    requestOpenAiStructured.mockResolvedValue({
      title: "Corrected title",
      summary: "Corrected summary",
      description: "Corrected description",
      origin: "Corrected origin",
      usage_note: "Corrected usage",
      caution: "Corrected caution",
      aliases: ["Corrected alias"],
      recommendation: "edit",
      confidence: "high",
      review_notes: ["Check the proper noun."],
    });
    createClient.mockResolvedValue(supabase);

    await expect(
      reviewMemeTranslationWithGpt({
        memeId: "meme-1",
        locale: "en",
        expectedTranslationUpdatedAt: EXPECTED_UPDATED_AT,
      }),
    ).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({ recommendation: "edit", confidence: "high" }),
    });

    expect(requestOpenAiStructured).toHaveBeenCalledWith(
      expect.objectContaining({ name: "meme_translation_review" }),
    );
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai.meme_translation_review",
        detail: expect.objectContaining({
          model: "gpt-5.6-sol",
          reasoning_effort: "high",
          auto_saved: false,
        }),
      }),
    );
    expect(source.update).not.toHaveBeenCalled();
    expect(localized.update).not.toHaveBeenCalled();
  });

  it("joins the source meme, applies filters, and paginates newest-first", async () => {
    const profile = query({ data: { role: "operator" }, error: null });
    const listing = query({
      data: [
        {
          meme_id: "meme-1",
          locale: "en",
          status: "machine",
          title: "Localized title",
          summary: "Localized summary",
          description: "Localized description",
          origin: "Localized origin",
          usage_note: null,
          caution: null,
          aliases: ["Alias"],
          source_updated_at: SOURCE_UPDATED_AT,
          translated_at: SOURCE_UPDATED_AT,
          updated_at: EXPECTED_UPDATED_AT,
          reviewed_at: null,
          reviewed_by: null,
          memes: {
            title: "원문 제목",
            summary: "원문 요약",
            description: "원문 설명",
            origin: "원문 유래",
            usage_note: null,
            caution: null,
            short_id: "abc123",
            updated_at: SOURCE_UPDATED_AT,
          },
        },
      ],
      error: null,
      count: 1,
    });
    const supabase = operatorClient({
      profiles: [profile],
      meme_translations: [listing],
    });
    createClient.mockResolvedValue(supabase);

    const result = await listTranslationsForReview({ locale: "en", status: "machine", page: 1 });

    expect(listing.range).toHaveBeenCalledWith(0, 9);
    expect(listing.eq).toHaveBeenCalledWith("locale", "en");
    expect(listing.eq).toHaveBeenCalledWith("status", "machine");
    expect(result).toEqual({
      ok: true,
      data: {
        page: 1,
        pageSize: 10,
        total: 1,
        rows: [
          expect.objectContaining({
            memeId: "meme-1",
            memeTitle: "원문 제목",
            locale: "en",
            status: "machine",
            title: "Localized title",
          }),
        ],
      },
    });
  });

  it("deletes only the CAS-matched translation and audits it", async () => {
    const context = contextQueries();
    const mutation = query({ data: { meme_id: "meme-1" }, error: null });
    const audit = query({ data: null, error: null });
    const supabase = operatorClient({
      profiles: [context.profile],
      memes: [context.meme],
      meme_translations: [context.translation, mutation],
      admin_audit_log: [audit],
    });
    createClient.mockResolvedValue(supabase);

    const result = await deleteMemeTranslation({
      memeId: "meme-1",
      locale: "en",
      expectedTranslationUpdatedAt: EXPECTED_UPDATED_AT,
    });

    expect(mutation.delete).toHaveBeenCalled();
    expect(mutation.eq).toHaveBeenCalledWith("updated_at", EXPECTED_UPDATED_AT);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meme_translation.delete" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/translations");
    expect(result).toEqual({ ok: true });
  });
});
