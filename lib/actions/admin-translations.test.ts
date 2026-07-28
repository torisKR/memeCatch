import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, revalidatePath } = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  markMemeTranslationStale,
  reviewMemeTranslation,
  saveMemeTranslation,
  type TranslationReviewInput,
} from "@/lib/actions/admin-translations";

const SOURCE_UPDATED_AT = "2026-07-28T01:00:00.000Z";
const EXPECTED_UPDATED_AT = "2026-07-28T01:05:00.000Z";

function query(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function operatorClient(tableQueries: Record<string, ReturnType<typeof query>[]>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "operator-1" } } }),
    },
    from: vi.fn((table: string) => {
      const next = tableQueries[table]?.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    }),
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
