"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/profile-access";
import type { Json } from "@/lib/database.types";
import {
  isSeoContentLocale,
  localizedMemePath,
  SEO_CONTENT_LOCALES,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";
import {
  computeTranslationCoverage,
  type PublicMemeRevision,
  type TranslationCoverageRow as TranslationCoverageInputRow,
} from "@/lib/translation-coverage";
import {
  getOpenAiReviewModel,
  OPENAI_REVIEW_REASONING_EFFORT,
  requestOpenAiStructured,
} from "@/lib/openai-review.server";
import {
  classifyTranslationWorklistSource,
  prioritizeTranslationWorklistRows,
} from "@/lib/translation-worklist";
import { sortTranslationSupplyPriorityRows } from "@/lib/translation-supply-control-tower";

export type TranslationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type TranslationReviewInput = {
  memeId: string;
  locale: SeoContentLocale;
  expectedTranslationUpdatedAt: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string;
  caution: string;
  aliases: string[];
};

export type TranslationAiReviewDraft = {
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string;
  caution: string;
  aliases: string[];
  recommendation: "approve" | "edit" | "reject";
  confidence: "high" | "medium" | "low";
  review_notes: string[];
};

export type TranslationAiReviewResult =
  | { ok: true; data: TranslationAiReviewDraft }
  | { ok: false; error: string };

export type MissingMemeTranslationRow = {
  memeId: string;
  shortId: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string | null;
  caution: string | null;
  aliases: string[];
  updatedAt: string;
  routeUnlockCandidate: boolean;
};

export type MissingMemeTranslationListResult =
  | { ok: true; data: MissingMemeTranslationRow[] }
  | { ok: false; error: string };

export type MissingMemeTranslationPreviewResult =
  | {
      ok: true;
      data: { sourceUpdatedAt: string; draft: TranslationAiReviewDraft };
    }
  | { ok: false; error: string };

export type MissingMemeTranslationDraftInput = {
  memeId: string;
  locale: SeoContentLocale;
  expectedSourceUpdatedAt: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string;
  caution: string;
  aliases: string[];
};

const TRANSLATION_AI_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
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
  ],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    description: { type: "string" },
    origin: { type: "string" },
    usage_note: { type: "string" },
    caution: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    recommendation: { type: "string", enum: ["approve", "edit", "reject"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    review_notes: { type: "array", items: { type: "string" } },
  },
} as const;

const MEME_ID_SCHEMA = z.uuid();
const TRANSLATION_PROMPT_VERSION = 1;

type TranslationIdentity = {
  meme_id: string;
  locale: string;
  localized_slug: string;
  source_updated_at: string;
  updated_at: string;
  status: string;
};

type MemeIdentity = {
  id: string;
  short_id: string;
  slug: string;
  updated_at: string;
};

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  if (!(await isOperator(supabase))) throw new Error("운영자 권한이 없어요.");
  return { supabase, uid: user.id };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
}

function sameInstant(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function validateInput(input: TranslationReviewInput, requireComplete: boolean): string | null {
  if (!input.memeId) return "밈 ID가 필요해요.";
  if (!isSeoContentLocale(input.locale)) return "지원하지 않는 번역 언어예요.";
  if (
    !input.expectedTranslationUpdatedAt ||
    !Number.isFinite(Date.parse(input.expectedTranslationUpdatedAt))
  ) {
    return "번역 revision 정보가 올바르지 않아요. 새로고침해 주세요.";
  }
  if (!input.title.trim()) return "번역 제목을 입력해 주세요.";
  if (!input.summary.trim()) return "번역 한 줄 요약을 입력해 주세요.";
  if (requireComplete && !input.description.trim()) return "검수 발행 전 설명을 입력해 주세요.";
  if (requireComplete && !input.origin.trim()) return "검수 발행 전 유래를 입력해 주세요.";
  if (input.title.length > 300 || input.summary.length > 1000) {
    return "제목 또는 한 줄 요약이 너무 길어요.";
  }
  return null;
}

function normalizedContent(input: TranslationReviewInput) {
  return {
    title: input.title.trim(),
    summary: input.summary.trim(),
    description: input.description.trim(),
    origin: input.origin.trim(),
    usage_note: input.usageNote.trim() || null,
    caution: input.caution.trim() || null,
    aliases: [...new Set(input.aliases.map((alias) => alias.trim()).filter(Boolean))],
  };
}

function localizedSlug(title: string, fallback: string) {
  const slug = title
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return slug || fallback;
}

function missingDraftValidationError(input: MissingMemeTranslationDraftInput): string | null {
  if (!MEME_ID_SCHEMA.safeParse(input.memeId).success) return "유효한 밈 ID가 필요해요.";
  if (!isSeoContentLocale(input.locale)) return "지원하지 않는 번역 언어예요.";
  if (
    !input.expectedSourceUpdatedAt ||
    !Number.isFinite(Date.parse(input.expectedSourceUpdatedAt))
  ) {
    return "원문 revision 정보가 올바르지 않아요. 새로고침해 주세요.";
  }
  if (!input.title.trim()) return "번역 제목을 입력해 주세요.";
  if (!input.summary.trim()) return "번역 한 줄 요약을 입력해 주세요.";
  if (!input.description.trim()) return "검수 대기 초안에 설명을 입력해 주세요.";
  if (!input.origin.trim()) return "검수 대기 초안에 유래를 입력해 주세요.";
  if (input.title.length > 300 || input.summary.length > 1000) {
    return "제목 또는 한 줄 요약이 너무 길어요.";
  }
  return null;
}

function missingDraftContent(input: MissingMemeTranslationDraftInput) {
  return {
    title: input.title.trim(),
    summary: input.summary.trim(),
    description: input.description.trim(),
    origin: input.origin.trim(),
    usage_note: input.usageNote.trim() || null,
    caution: input.caution.trim() || null,
    aliases: [...new Set(input.aliases.map((alias) => alias.trim()).filter(Boolean))],
  };
}

export async function reviewMemeTranslationWithGpt(input: {
  memeId: string;
  locale: SeoContentLocale;
  expectedTranslationUpdatedAt: string;
}): Promise<TranslationAiReviewResult> {
  try {
    if (
      !input.memeId ||
      !isSeoContentLocale(input.locale) ||
      !input.expectedTranslationUpdatedAt ||
      !Number.isFinite(Date.parse(input.expectedTranslationUpdatedAt))
    ) {
      return { ok: false, error: "유효한 밈과 번역 revision이 필요해요." };
    }

    const { supabase, uid } = await requireOperator();
    const { meme, translation } = await loadTranslationContext(
      supabase,
      input.memeId,
      input.locale,
    );
    if (translation.updated_at !== input.expectedTranslationUpdatedAt) {
      return { ok: false, error: "번역이 변경되어 GPT 검수를 실행하지 못했어요. 새로고침해 주세요." };
    }

    const [{ data: source, error: sourceError }, { data: localized, error: localizedError }] =
      await Promise.all([
        supabase
          .from("memes")
          .select("title, summary, description, origin, usage_note, caution, aliases")
          .eq("id", input.memeId)
          .single(),
        supabase
          .from("meme_translations")
          .select("title, summary, description, origin, usage_note, caution, aliases")
          .eq("meme_id", input.memeId)
          .eq("locale", input.locale)
          .single(),
    ]);
    if (sourceError || !source) return { ok: false, error: "한국어 원문을 찾을 수 없어요." };
    if (localizedError || !localized) return { ok: false, error: "번역 초안을 찾을 수 없어요." };
    if (
      getOpenAiReviewModel() !== "gpt-5.6-sol" ||
      OPENAI_REVIEW_REASONING_EFFORT !== "high"
    ) {
      return { ok: false, error: "GPT 검수 AI 계약이 올바르지 않아요." };
    }

    const draft = await requestOpenAiStructured<TranslationAiReviewDraft>({
      name: "meme_translation_review",
      schema: TRANSLATION_AI_REVIEW_SCHEMA,
      instructions:
        "당신은 한국 밈 사전 서비스의 다국어 편집 검수자입니다. " +
        `한국어 원문을 ${input.locale} 번역 초안과 대조해 의미, 고유명사, 안전 문구, 사실 단정 여부를 검수합니다. ` +
        "입력에 없는 사실과 출처를 만들지 말고, 불확실하면 review_notes에 적습니다. " +
        "수정이 필요하면 전체 교정본을 반환합니다. recommendation은 approve=그대로 발행 가능, edit=교정본을 운영자가 확인한 뒤 발행, reject=원문 근거 부족·유해성·번역 불가로 발행하지 않는 경우입니다. " +
        "자동 저장·자동 발행을 하지 않으며 운영자의 최종 승인을 전제로 합니다.",
      input: JSON.stringify(
        {
          locale: input.locale,
          source_meme: source,
          localized_draft: localized,
          source_updated_at: meme.updated_at,
        },
        null,
        2,
      ),
    });

    await logAudit(supabase, uid, "ai.meme_translation_review", meme.id, input.locale, {
      model: getOpenAiReviewModel(),
      reasoning_effort: OPENAI_REVIEW_REASONING_EFFORT,
      recommendation: draft.recommendation,
      confidence: draft.confidence,
      auto_saved: false,
    });
    return { ok: true, data: draft };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function previewMissingMemeTranslationWithGpt(input: {
  memeId: string;
  locale: string;
  expectedSourceUpdatedAt: string;
}): Promise<MissingMemeTranslationPreviewResult> {
  try {
    if (
      !MEME_ID_SCHEMA.safeParse(input.memeId).success ||
      !isSeoContentLocale(input.locale) ||
      !input.expectedSourceUpdatedAt ||
      !Number.isFinite(Date.parse(input.expectedSourceUpdatedAt))
    ) {
      return { ok: false, error: "유효한 밈과 원문 revision이 필요해요." };
    }

    const { supabase } = await requireOperator();
    const [{ data: source, error: sourceError }, { data: existing, error: existingError }] =
      await Promise.all([
        supabase
          .from("memes")
          .select(
            "id, short_id, title, summary, description, origin, usage_note, caution, aliases, updated_at",
          )
          .eq("id", input.memeId)
          .in("moderation_status", ["approved", "limited"])
          .maybeSingle(),
        supabase
          .from("meme_translations")
          .select("meme_id")
          .eq("meme_id", input.memeId)
          .eq("locale", input.locale)
          .maybeSingle(),
      ]);
    if (sourceError || !source) {
      return { ok: false, error: "공개 가능한 원문 밈을 찾을 수 없어요." };
    }
    if (!sameInstant(source.updated_at, input.expectedSourceUpdatedAt)) {
      return { ok: false, error: "원문이 변경되어 번역 미리보기를 만들지 못했어요. 새로고침해 주세요." };
    }
    if (existingError) return { ok: false, error: existingError.message };
    if (existing) return { ok: false, error: "이미 해당 언어의 번역 행이 있어요." };
    if (
      getOpenAiReviewModel() !== "gpt-5.6-sol" ||
      OPENAI_REVIEW_REASONING_EFFORT !== "high"
    ) {
      return { ok: false, error: "번역 미리보기 AI 계약이 올바르지 않아요." };
    }

    const draft = await requestOpenAiStructured<TranslationAiReviewDraft>({
      name: "missing_meme_translation_preview",
      schema: TRANSLATION_AI_REVIEW_SCHEMA,
      instructions:
        `이 작업은 한국 밈 사전 원문을 ${input.locale}로 옮기는 번역 초안 미리보기입니다. ` +
        "반드시 제공된 원문만 사용하고, 원문에 없는 사실이나 출처를 만들지 마세요. " +
        "원문의 불확실성, 추정, 단서를 그대로 보존하고 필요한 주의는 review_notes에 남기세요. " +
        "자동 저장이나 자동 발행을 전제로 하지 마세요. 인간 운영자가 결과를 검토한 뒤 별도로 저장하고 발행해야 합니다. " +
        "recommendation은 운영자 검토 관점에서 approve, edit, reject 중 하나로 반환하세요.",
      input: JSON.stringify(
        {
          locale: input.locale,
          source_meme: source,
          source_updated_at: source.updated_at,
          preview_only: true,
        },
        null,
        2,
      ),
    });

    const [
      { data: latestSource, error: latestSourceError },
      { data: latestTranslation, error: latestTranslationError },
    ] = await Promise.all([
      supabase
        .from("memes")
        .select("updated_at")
        .eq("id", input.memeId)
        .in("moderation_status", ["approved", "limited"])
        .maybeSingle(),
      supabase
        .from("meme_translations")
        .select("meme_id")
        .eq("meme_id", input.memeId)
        .eq("locale", input.locale)
        .maybeSingle(),
    ]);
    if (latestSourceError || latestTranslationError) {
      return { ok: false, error: "번역 미리보기 상태를 다시 확인하지 못했어요. 새로고침해 주세요." };
    }
    if (
      !latestSource ||
      !sameInstant(latestSource.updated_at, source.updated_at) ||
      latestTranslation
    ) {
      return { ok: false, error: "원문 또는 번역 상태가 변경되어 초안을 폐기했어요. 새로고침해 주세요." };
    }

    return { ok: true, data: { sourceUpdatedAt: source.updated_at, draft } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveMissingMemeTranslationDraft(
  input: MissingMemeTranslationDraftInput,
): Promise<TranslationActionResult> {
  try {
    const validationError = missingDraftValidationError(input);
    if (validationError) return { ok: false, error: validationError };

    const { supabase, uid } = await requireOperator();
    const { data: source, error: sourceError } = await supabase
      .from("memes")
      .select("id, short_id, slug, updated_at, moderation_status")
      .eq("id", input.memeId)
      .in("moderation_status", ["approved", "limited"])
      .maybeSingle();
    if (sourceError || !source) {
      return { ok: false, error: "공개 가능한 원문 밈을 찾을 수 없어요." };
    }
    if (!sameInstant(source.updated_at, input.expectedSourceUpdatedAt)) {
      return { ok: false, error: "원문이 변경되어 저장하지 못했어요. 새로고침해 주세요." };
    }

    const { data: existing, error: existingError } = await supabase
      .from("meme_translations")
      .select("meme_id")
      .eq("meme_id", input.memeId)
      .eq("locale", input.locale)
      .maybeSingle();
    if (existingError) return { ok: false, error: existingError.message };
    if (existing) return { ok: false, error: "이미 해당 언어의 번역 행이 있어요. 검수 큐를 새로고침해 주세요." };

    const content = missingDraftContent(input);
    const { error: insertError } = await supabase.from("meme_translations").insert({
      meme_id: input.memeId,
      locale: input.locale,
      localized_slug: localizedSlug(content.title, source.slug),
      ...content,
      status: "machine",
      source_updated_at: source.updated_at,
      provider: "openai",
      model: getOpenAiReviewModel(),
      prompt_version: TRANSLATION_PROMPT_VERSION,
      reviewed_at: null,
      reviewed_by: null,
    });
    if (insertError) {
      if (insertError.code === "23505") {
        return { ok: false, error: "다른 운영자가 먼저 저장했어요. 검수 큐를 새로고침해 주세요." };
      }
      return { ok: false, error: insertError.message };
    }

    try {
      await logAudit(supabase, uid, "meme_translation.draft_create", input.memeId, input.locale, {
        status: "machine",
        source_updated_at: source.updated_at,
        model: getOpenAiReviewModel(),
        reasoning_effort: OPENAI_REVIEW_REASONING_EFFORT,
        prompt_version: TRANSLATION_PROMPT_VERSION,
        auto_published: false,
      });
    } finally {
      revalidatePath("/admin/translations");
      revalidatePath(`/admin/memes/${input.memeId}`);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function loadTranslationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memeId: string,
  locale: SeoContentLocale,
): Promise<{ meme: MemeIdentity; translation: TranslationIdentity }> {
  const [{ data: meme, error: memeError }, { data: translation, error: translationError }] =
    await Promise.all([
      supabase
        .from("memes")
        .select("id, short_id, slug, updated_at")
        .eq("id", memeId)
        .maybeSingle(),
      supabase
        .from("meme_translations")
        .select("meme_id, locale, localized_slug, source_updated_at, updated_at, status")
        .eq("meme_id", memeId)
        .eq("locale", locale)
        .maybeSingle(),
    ]);

  if (memeError || !meme) throw new Error("원문 밈을 찾을 수 없어요.");
  if (translationError || !translation) throw new Error("번역 초안을 찾을 수 없어요.");
  return { meme, translation };
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  memeId: string,
  locale: SeoContentLocale,
  detail?: Record<string, unknown>,
) {
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "meme_translation",
    entity_id: memeId,
    detail: { locale, ...(detail ?? {}) } as Json,
  });
  if (error) throw new Error(`감사 로그를 기록하지 못했어요: ${error.message}`);
}

async function auditAndRevalidate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  meme: MemeIdentity,
  locale: SeoContentLocale,
  localizedSlug: string,
  detail?: Record<string, unknown>,
) {
  try {
    await logAudit(supabase, actorId, action, meme.id, locale, detail);
  } finally {
    // A successful mutation must refresh the UI even if audit persistence fails.
    revalidateTranslationPaths(meme, locale, localizedSlug);
  }
}

function revalidateTranslationPaths(
  meme: MemeIdentity,
  locale: SeoContentLocale,
  localizedSlug: string,
) {
  revalidatePath(`/admin/memes/${meme.id}`);
  revalidatePath(memePathFrom(meme.short_id, meme.slug));
  revalidatePath(localizedMemePath(locale, meme.short_id, localizedSlug));
  revalidatePath(`/${locale}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/llms-full.txt");
  revalidatePath(`/${locale}/llms.txt`);
  revalidatePath(`/${locale}/llms-full.txt`);
}

/** 편집한 번역은 반드시 다시 검수하도록 machine(현재) 또는 stale(원문 변경)로 돌린다. */
export async function saveMemeTranslation(
  input: TranslationReviewInput,
): Promise<TranslationActionResult> {
  try {
    const validationError = validateInput(input, false);
    if (validationError) return { ok: false, error: validationError };

    const { supabase, uid } = await requireOperator();
    const { meme, translation } = await loadTranslationContext(
      supabase,
      input.memeId,
      input.locale,
    );
    const current = sameInstant(meme.updated_at, translation.source_updated_at);
    const { data, error } = await supabase
      .from("meme_translations")
      .update({
        ...normalizedContent(input),
        status: current ? "machine" : "stale",
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq("meme_id", input.memeId)
      .eq("locale", input.locale)
      .eq("updated_at", input.expectedTranslationUpdatedAt)
      .eq("source_updated_at", translation.source_updated_at)
      .select("meme_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "번역이 변경되어 저장하지 못했어요. 새로고침해 주세요." };

    await auditAndRevalidate(
      supabase,
      uid,
      "meme_translation.save",
      meme,
      input.locale,
      translation.localized_slug,
      {
        status: current ? "machine" : "stale",
        previous_updated_at: input.expectedTranslationUpdatedAt,
      },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * 현재 원문 revision과 정확히 일치하는 번역만 reviewed로 발행한다.
 * 검수 update 뒤 원문을 다시 읽어 동시 수정도 감지하며, 이후 수정은 DB trigger가
 * 즉시 stale로 되돌린다.
 */
export async function reviewMemeTranslation(
  input: TranslationReviewInput,
): Promise<TranslationActionResult> {
  try {
    const validationError = validateInput(input, true);
    if (validationError) return { ok: false, error: validationError };

    const { supabase, uid } = await requireOperator();
    const { meme, translation } = await loadTranslationContext(
      supabase,
      input.memeId,
      input.locale,
    );
    if (!sameInstant(meme.updated_at, translation.source_updated_at)) {
      return {
        ok: false,
        error: "한국어 원문이 번역 후 변경됐어요. 번역을 다시 생성하거나 갱신한 뒤 검수해 주세요.",
      };
    }

    const reviewedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("meme_translations")
      .update({
        ...normalizedContent(input),
        status: "reviewed",
        reviewed_at: reviewedAt,
        reviewed_by: uid,
      })
      .eq("meme_id", input.memeId)
      .eq("locale", input.locale)
      .eq("updated_at", input.expectedTranslationUpdatedAt)
      .eq("source_updated_at", meme.updated_at)
      .select("meme_id, updated_at")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) {
      return { ok: false, error: "원문 또는 번역이 변경되어 검수하지 못했어요. 새로고침해 주세요." };
    }

    const { data: latestMeme, error: latestMemeError } = await supabase
      .from("memes")
      .select("updated_at")
      .eq("id", input.memeId)
      .single();
    if (
      latestMemeError ||
      !latestMeme ||
      !sameInstant(latestMeme.updated_at, translation.source_updated_at)
    ) {
      const { data: staleTranslation, error: staleError } = await supabase
        .from("meme_translations")
        .update({ status: "stale", reviewed_at: null, reviewed_by: null })
        .eq("meme_id", input.memeId)
        .eq("locale", input.locale)
        .eq("updated_at", data.updated_at)
        .select("meme_id")
        .maybeSingle();

      const recoveryError = staleError
        ? `stale 복구에 실패했어요: ${staleError.message}`
        : !staleTranslation
          ? "번역이 동시에 변경되어 stale 복구를 적용하지 못했어요. 새로고침해 주세요."
          : null;
      await auditAndRevalidate(
        supabase,
        uid,
        "meme_translation.review_source_changed",
        meme,
        input.locale,
        translation.localized_slug,
        {
          source_updated_at: translation.source_updated_at,
          reviewed_at: reviewedAt,
          stale_recovered: Boolean(staleTranslation),
          ...(latestMemeError ? { source_check_error: latestMemeError.message } : {}),
          ...(recoveryError ? { recovery_error: recoveryError } : {}),
        },
      );
      if (recoveryError) return { ok: false, error: recoveryError };
      return {
        ok: false,
        error: "검수 도중 한국어 원문이 변경되어 번역을 stale 상태로 되돌렸어요.",
      };
    }

    await auditAndRevalidate(
      supabase,
      uid,
      "meme_translation.review",
      meme,
      input.locale,
      translation.localized_slug,
      {
        source_updated_at: translation.source_updated_at,
        reviewed_at: reviewedAt,
        previous_updated_at: input.expectedTranslationUpdatedAt,
      },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/* ── 번역 검수 큐 (전체 밈 대상 목록) ──────────────────────
 * 메메 상세 페이지(/admin/memes/[id])는 밈 1건의 번역만 보여주므로,
 * 검수 대기 중인 번역을 밈 전체에서 찾으려면 개별 페이지를 순회해야 했다.
 * 아래는 그 갭을 메우는 읽기 전용 목록과, 큐 화면 전용 반려/삭제 액션이다.
 * 저장·발행·stale 전환은 위의 검증된 CAS 로직을 그대로 재사용한다.
 */

export type TranslationReviewStatus = "machine" | "reviewed" | "stale";

export type TranslationQueueRow = {
  memeId: string;
  memeTitle: string;
  memeSummary: string;
  memeDescription: string;
  memeOrigin: string;
  memeUsageNote: string | null;
  memeCaution: string | null;
  memeShortId: string;
  memeUpdatedAt: string;
  locale: SeoContentLocale;
  status: TranslationReviewStatus;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string | null;
  caution: string | null;
  aliases: string[];
  sourceUpdatedAt: string;
  translatedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type TranslationQueuePage = {
  rows: TranslationQueueRow[];
  page: number;
  pageSize: number;
  total: number;
};

export type TranslationQueueResult =
  | { ok: true; data: TranslationQueuePage }
  | { ok: false; error: string };

export type TranslationPriorityQueueRow = {
  memeId: string;
  locale: SeoContentLocale;
  requestCount: number;
  latestRequestedAt: string;
  status: "requested" | "in_review";
  memeTitle: string;
  memeShortId: string;
  memeSlug: string;
  translationStatus: string | null;
  translationUpdatedAt: string | null;
  sourceUpdatedAt: string | null;
  routeUnlockCandidate: boolean;
};

export type TranslationPriorityQueueResult =
  | { ok: true; data: TranslationPriorityQueueRow[] }
  | { ok: false; error: string };

export type TranslationCoverageViewRow = {
  locale: SeoContentLocale;
  totalPublic: number;
  reviewedCurrent: number;
  reviewNeeded: number;
  stale: number;
  missing: number;
  completionPercentage: number;
};

export type TranslationCoverageResult =
  | { ok: true; data: TranslationCoverageViewRow[] }
  | { ok: false; error: string };

const TRANSLATION_QUEUE_PAGE_SIZE = 10;
const TRANSLATION_COVERAGE_PAGE_SIZE = 1000;
const MISSING_TRANSLATION_DEFAULT_LIMIT = 20;
const MISSING_TRANSLATION_MAX_LIMIT = 100;
const TRANSLATION_SUPPLY_ID_BATCH_SIZE = 200;

type MissingMemeSourceQueryRow = {
  id: string;
  short_id: string;
  slug: string;
  moderation_status?: string | null;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  aliases: string[];
  updated_at: string;
  usage_examples: unknown;
  meme_sources: { source_url: string | null }[] | null;
  meme_contents: { availability: string | null; moderation_status: string | null }[] | null;
  meme_tags_map: { tag_id: string | null }[] | null;
};

type TranslationSupplyDemandQueryRow = {
  meme_id: string;
  locale: string;
  status: string;
  created_at: string;
  memes: MissingMemeSourceQueryRow | null;
};

type TranslationSupplyStatusQueryRow = {
  meme_id: string;
  locale: string;
  status: string | null;
  source_updated_at: string | null;
  updated_at: string | null;
};

const MISSING_MEME_SELECT =
  "id, short_id, slug, title, summary, description, origin, usage_note, caution, aliases, usage_examples, updated_at, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)";
const TRANSLATION_SUPPLY_SOURCE_SELECT = `${MISSING_MEME_SELECT}, moderation_status`;

async function loadTranslatedMemeIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locale: SeoContentLocale,
): Promise<{ ids: Set<string>; error: string | null }> {
  const ids = new Set<string>();
  for (let from = 0; ; from += TRANSLATION_COVERAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meme_translations")
      .select("meme_id")
      .eq("locale", locale)
      .order("meme_id", { ascending: true })
      .range(from, from + TRANSLATION_COVERAGE_PAGE_SIZE - 1);
    if (error) return { ids: new Set(), error: error.message };
    for (const row of data ?? []) ids.add(row.meme_id);
    if ((data ?? []).length < TRANSLATION_COVERAGE_PAGE_SIZE) break;
  }
  return { ids, error: null };
}

export async function listMissingMemeTranslations(input: {
  locale: string;
  limit?: number;
  focusMemeId?: string;
  priorityMemeIds?: readonly string[];
}): Promise<MissingMemeTranslationListResult> {
  try {
    if (!isSeoContentLocale(input.locale)) {
      return { ok: false, error: "지원하지 않는 번역 언어예요." };
    }
    const requestedLimit = Number.isFinite(input.limit)
      ? Math.trunc(input.limit ?? MISSING_TRANSLATION_DEFAULT_LIMIT)
      : MISSING_TRANSLATION_DEFAULT_LIMIT;
    const limit = Math.min(
      MISSING_TRANSLATION_MAX_LIMIT,
      Math.max(1, requestedLimit),
    );
    if (input.focusMemeId && !MEME_ID_SCHEMA.safeParse(input.focusMemeId).success) {
      return { ok: false, error: "집중할 밈 ID가 올바르지 않아요." };
    }
    const priorityMemeIds = new Set(input.priorityMemeIds ?? []);
    if (priorityMemeIds.size > MISSING_TRANSLATION_MAX_LIMIT) {
      return { ok: false, error: "번역 우선순위 목록이 너무 커요. 새로고침해 주세요." };
    }
    for (const memeId of priorityMemeIds) {
      if (!MEME_ID_SCHEMA.safeParse(memeId).success) {
        return { ok: false, error: "번역 우선순위 밈 ID가 올바르지 않아요." };
      }
    }
    const { supabase } = await requireOperator();
    const translated = await loadTranslatedMemeIds(supabase, input.locale);
    if (translated.error) return { ok: false, error: translated.error };

    const rows: MissingMemeTranslationRow[] = [];
    const appendRow = (row: MissingMemeSourceQueryRow) => {
      const worklistRow = classifyTranslationWorklistSource({
        memeId: row.id,
        shortId: row.short_id,
        title: row.title,
        updatedAt: row.updated_at,
        description: row.description,
        origin: row.origin,
        usage_note: row.usage_note,
        caution: row.caution,
        usage_examples: row.usage_examples,
        meme_sources: row.meme_sources,
        meme_contents: row.meme_contents,
        meme_tags_map: row.meme_tags_map,
      });
      rows.push({
        memeId: row.id,
        shortId: row.short_id,
        title: row.title,
        summary: row.summary,
        description: row.description,
        origin: row.origin,
        usageNote: row.usage_note,
        caution: row.caution,
        aliases: row.aliases,
        updatedAt: row.updated_at,
        routeUnlockCandidate: worklistRow.routeUnlockCandidate,
      });
    };

    if (input.focusMemeId && !translated.ids.has(input.focusMemeId)) {
      const { data: focused, error: focusedError } = await supabase
        .from("memes")
        .select(MISSING_MEME_SELECT)
        .eq("id", input.focusMemeId)
        .in("moderation_status", ["approved", "limited"])
        .maybeSingle()
        .overrideTypes<MissingMemeSourceQueryRow, { merge: false }>();
      if (focusedError) return { ok: false, error: focusedError.message };
      if (focused) appendRow(focused);
    }

    for (let from = 0; ; from += TRANSLATION_COVERAGE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("memes")
        .select(MISSING_MEME_SELECT)
        .in("moderation_status", ["approved", "limited"])
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + TRANSLATION_COVERAGE_PAGE_SIZE - 1)
        .overrideTypes<MissingMemeSourceQueryRow[], { merge: false }>();
      if (error) return { ok: false, error: error.message };

      for (const row of data ?? []) {
        if (translated.ids.has(row.id) || rows.some((existing) => existing.memeId === row.id)) continue;
        appendRow(row);
      }
      if ((data ?? []).length < TRANSLATION_COVERAGE_PAGE_SIZE) break;
    }
    const sortedRows = prioritizeTranslationWorklistRows(rows, priorityMemeIds);
    if (!input.focusMemeId) return { ok: true, data: sortedRows.slice(0, limit) };
    const focusedRow = sortedRows.find((row) => row.memeId === input.focusMemeId);
    if (!focusedRow) return { ok: true, data: sortedRows.slice(0, limit) };
    return {
      ok: true,
      data: [focusedRow, ...sortedRows.filter((row) => row.memeId !== input.focusMemeId).slice(0, limit - 1)],
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function loadPublicMemeRevisions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ rows: PublicMemeRevision[]; error: string | null }> {
  const rows: PublicMemeRevision[] = [];
  for (let from = 0; ; from += TRANSLATION_COVERAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("memes")
      .select("id, updated_at")
      .in("moderation_status", ["approved", "limited"])
      .range(from, from + TRANSLATION_COVERAGE_PAGE_SIZE - 1)
      .overrideTypes<PublicMemeRevision[], { merge: false }>();
    if (error) return { rows: [], error: error.message };
    rows.push(...(data ?? []));
    if ((data ?? []).length < TRANSLATION_COVERAGE_PAGE_SIZE) break;
  }
  return { rows, error: null };
}

async function loadPublicTranslationCoverageRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ rows: TranslationCoverageInputRow[]; error: string | null }> {
  const rows: TranslationCoverageInputRow[] = [];
  for (let from = 0; ; from += TRANSLATION_COVERAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meme_translations")
      .select("meme_id, locale, status, source_updated_at, memes!inner(updated_at, moderation_status)")
      .in("locale", [...SEO_CONTENT_LOCALES])
      .in("memes.moderation_status", ["approved", "limited"])
      .range(from, from + TRANSLATION_COVERAGE_PAGE_SIZE - 1)
      .overrideTypes<TranslationCoverageInputRow[], { merge: false }>();
    if (error) return { rows: [], error: error.message };
    rows.push(...(data ?? []));
    if ((data ?? []).length < TRANSLATION_COVERAGE_PAGE_SIZE) break;
  }
  return { rows, error: null };
}

export async function getTranslationCoverage(): Promise<TranslationCoverageResult> {
  try {
    const { supabase } = await requireOperator();
    const publicMemes = await loadPublicMemeRevisions(supabase);
    if (publicMemes.error) return { ok: false, error: publicMemes.error };
    const translations = await loadPublicTranslationCoverageRows(supabase);
    if (translations.error) return { ok: false, error: translations.error };

    const coverage = computeTranslationCoverage(publicMemes.rows, translations.rows);
    return {
      ok: true,
      data: coverage.map((row) => ({
        locale: row.locale,
        totalPublic: row.total,
        reviewedCurrent: row.reviewedCurrent.length,
        reviewNeeded: row.machineCurrent.length,
        stale: row.stale.length,
        missing: row.missing.length,
        completionPercentage: row.completionPercentage,
      })),
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** 로케일·상태 필터 + 최신순 페이지네이션으로 검수 대상 번역을 모은다. */
export async function listTranslationsForReview(
  input: {
    locale?: SeoContentLocale;
    status?: TranslationReviewStatus;
    page?: number;
  } = {},
): Promise<TranslationQueueResult> {
  try {
    const { supabase } = await requireOperator();
    const page = Math.max(1, Math.trunc(input.page ?? 1));
    const from = (page - 1) * TRANSLATION_QUEUE_PAGE_SIZE;
    const to = from + TRANSLATION_QUEUE_PAGE_SIZE - 1;

    let query = supabase
      .from("meme_translations")
      .select(
        "meme_id, locale, status, title, summary, description, origin, usage_note, caution, aliases, source_updated_at, translated_at, updated_at, reviewed_at, reviewed_by, memes(title, summary, description, origin, usage_note, caution, short_id, updated_at)",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (input.locale) query = query.eq("locale", input.locale);
    if (input.status) query = query.eq("status", input.status);

    const { data, error, count } = await query;
    if (error) return { ok: false, error: error.message };

    const rows: TranslationQueueRow[] = (data ?? [])
      .filter((row) => row.memes)
      .map((row) => {
        const meme = row.memes!;
        return {
          memeId: row.meme_id,
          memeTitle: meme.title,
          memeSummary: meme.summary,
          memeDescription: meme.description,
          memeOrigin: meme.origin,
          memeUsageNote: meme.usage_note,
          memeCaution: meme.caution,
          memeShortId: meme.short_id,
          memeUpdatedAt: meme.updated_at,
          locale: row.locale as SeoContentLocale,
          status: row.status as TranslationReviewStatus,
          title: row.title,
          summary: row.summary,
          description: row.description,
          origin: row.origin,
          usageNote: row.usage_note,
          caution: row.caution,
          aliases: row.aliases,
          sourceUpdatedAt: row.source_updated_at,
          translatedAt: row.translated_at,
          updatedAt: row.updated_at,
          reviewedAt: row.reviewed_at,
          reviewedBy: row.reviewed_by,
        };
      });

    return {
      ok: true,
      data: { rows, page, pageSize: TRANSLATION_QUEUE_PAGE_SIZE, total: count ?? rows.length },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function listTranslationPriorityQueue(
  limit = 50,
  locale?: SeoContentLocale,
): Promise<TranslationPriorityQueueResult> {
  try {
    const { supabase } = await requireOperator();
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const { data, error } = await supabase.rpc(
      "list_translation_priority_queue",
      locale
        ? { p_limit: safeLimit, p_locale: locale }
        : { p_limit: safeLimit },
    );
    if (error) return { ok: false, error: error.message };

    const rows: Omit<TranslationPriorityQueueRow, "routeUnlockCandidate">[] = (data ?? [])
      .filter((row) => isSeoContentLocale(row.locale))
      .map((row) => ({
        memeId: row.meme_id,
        locale: row.locale as SeoContentLocale,
        requestCount: row.request_count,
        latestRequestedAt: row.latest_requested_at,
        status: row.status === "in_review" ? "in_review" : "requested",
        memeTitle: row.meme_title,
        memeShortId: row.meme_short_id,
        memeSlug: row.meme_slug,
        translationStatus: row.translation_status,
        translationUpdatedAt: row.translation_updated_at,
        sourceUpdatedAt: row.source_updated_at,
      }));
    if (rows.length === 0) return { ok: true, data: [] };

    const { data: sourceRows, error: sourceError } = await supabase
      .from("memes")
      .select(MISSING_MEME_SELECT)
      .in("id", rows.map((row) => row.memeId))
      .in("moderation_status", ["approved", "limited"])
      .overrideTypes<MissingMemeSourceQueryRow[], { merge: false }>();
    if (sourceError) return { ok: false, error: sourceError.message };

    const routeUnlockByMemeId = new Map(
      (sourceRows ?? []).map((source) => [
        source.id,
        classifyTranslationWorklistSource({
          memeId: source.id,
          shortId: source.short_id,
          title: source.title,
          updatedAt: source.updated_at,
          description: source.description,
          origin: source.origin,
          usage_note: source.usage_note,
          caution: source.caution,
          usage_examples: source.usage_examples,
          meme_sources: source.meme_sources,
          meme_contents: source.meme_contents,
          meme_tags_map: source.meme_tags_map,
        }).routeUnlockCandidate,
      ]),
    );

    return {
      ok: true,
      data: rows.map((row) => ({
        ...row,
        routeUnlockCandidate:
          row.translationStatus === null && routeUnlockByMemeId.get(row.memeId) === true,
      })),
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function listTranslationSupplyPriorityQueue(
  limit = 50,
): Promise<TranslationPriorityQueueResult> {
  try {
    const { supabase } = await requireOperator();
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const demandRows: TranslationSupplyDemandQueryRow[] = [];
    for (let from = 0; ; from += TRANSLATION_COVERAGE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("plus_translation_requests")
        .select(`meme_id, locale, status, created_at, memes!inner(${TRANSLATION_SUPPLY_SOURCE_SELECT})`)
        .in("status", ["requested", "in_review"])
        .in("memes.moderation_status", ["approved", "limited"])
        .order("meme_id", { ascending: true })
        .order("locale", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + TRANSLATION_COVERAGE_PAGE_SIZE - 1)
        .overrideTypes<TranslationSupplyDemandQueryRow[], { merge: false }>();
      if (error) return { ok: false, error: error.message };
      demandRows.push(...(data ?? []));
      if ((data ?? []).length < TRANSLATION_COVERAGE_PAGE_SIZE) break;
    }

    const groups = new Map<
      string,
      {
        meme: MissingMemeSourceQueryRow;
        locale: SeoContentLocale;
        requestCount: number;
        latestRequestedAt: string;
        status: "requested" | "in_review";
      }
    >();
    for (const row of demandRows ?? []) {
      if (!isSeoContentLocale(row.locale) || !row.memes) continue;
      const key = `${row.meme_id}\u0000${row.locale}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          meme: row.memes,
          locale: row.locale,
          requestCount: 1,
          latestRequestedAt: row.created_at,
          status: row.status === "in_review" ? "in_review" : "requested",
        });
        continue;
      }
      existing.requestCount += 1;
      if (Date.parse(row.created_at) > Date.parse(existing.latestRequestedAt)) {
        existing.latestRequestedAt = row.created_at;
      }
      if (row.status === "in_review") existing.status = "in_review";
    }
    if (groups.size === 0) return { ok: true, data: [] };

    const memeIds = [...new Set([...groups.values()].map((group) => group.meme.id))];
    const translationRows: TranslationSupplyStatusQueryRow[] = [];
    for (let from = 0; from < memeIds.length; from += TRANSLATION_SUPPLY_ID_BATCH_SIZE) {
      const ids = memeIds.slice(from, from + TRANSLATION_SUPPLY_ID_BATCH_SIZE);
      const { data, error } = await supabase
        .from("meme_translations")
        .select("meme_id, locale, status, source_updated_at, updated_at")
        .in("meme_id", ids)
        .in("locale", [...SEO_CONTENT_LOCALES])
        .overrideTypes<TranslationSupplyStatusQueryRow[], { merge: false }>();
      if (error) return { ok: false, error: error.message };
      translationRows.push(...(data ?? []));
    }

    const translationsByKey = new Map(
      (translationRows ?? []).map((row) => [`${row.meme_id}\u0000${row.locale}`, row]),
    );
    const rows = [...groups.entries()].map(([key, group]) => {
      const translation = translationsByKey.get(key);
      const routeUnlockCandidate =
        translation?.status == null &&
        classifyTranslationWorklistSource({
          memeId: group.meme.id,
          shortId: group.meme.short_id,
          title: group.meme.title,
          updatedAt: group.meme.updated_at,
          description: group.meme.description,
          origin: group.meme.origin,
          usage_note: group.meme.usage_note,
          caution: group.meme.caution,
          usage_examples: group.meme.usage_examples,
          meme_sources: group.meme.meme_sources,
          meme_contents: group.meme.meme_contents,
          meme_tags_map: group.meme.meme_tags_map,
        }).routeUnlockCandidate;
      return {
        memeId: group.meme.id,
        locale: group.locale,
        requestCount: group.requestCount,
        latestRequestedAt: group.latestRequestedAt,
        status: group.status,
        memeTitle: group.meme.title,
        memeShortId: group.meme.short_id,
        memeSlug: group.meme.slug,
        translationStatus: translation?.status ?? null,
        translationUpdatedAt: translation?.updated_at ?? null,
        sourceUpdatedAt: translation?.source_updated_at ?? null,
        routeUnlockCandidate,
      } satisfies TranslationPriorityQueueRow;
    });

    return { ok: true, data: sortTranslationSupplyPriorityRows(rows).slice(0, safeLimit) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function claimTranslationPriority(input: {
  memeId: string;
  locale: SeoContentLocale;
}): Promise<TranslationActionResult> {
  try {
    if (!input.memeId || !isSeoContentLocale(input.locale)) {
      return { ok: false, error: "유효한 밈과 번역 언어가 필요해요." };
    }
    const { supabase } = await requireOperator();
    const { error } = await supabase.rpc("claim_translation_priority_request", {
      p_meme_id: input.memeId,
      p_locale: input.locale,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/translations");
    revalidatePath(`/admin/memes/${input.memeId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** 큐 화면 전용 반려 — DB 상태는 바꾸지 않고(그대로 재검수 대상) 사유만 감사 로그에 남긴다. */
export async function rejectMemeTranslationDraft(input: {
  memeId: string;
  locale: SeoContentLocale;
  expectedTranslationUpdatedAt: string;
  reason: string;
}): Promise<TranslationActionResult> {
  try {
    if (!input.memeId || !isSeoContentLocale(input.locale)) {
      return { ok: false, error: "유효한 밈과 번역 언어가 필요해요." };
    }
    if (!input.reason.trim()) return { ok: false, error: "반려 사유를 입력해 주세요." };

    const { supabase, uid } = await requireOperator();
    const { meme, translation } = await loadTranslationContext(
      supabase,
      input.memeId,
      input.locale,
    );
    if (translation.updated_at !== input.expectedTranslationUpdatedAt) {
      return { ok: false, error: "번역이 변경되어 반려하지 못했어요. 새로고침해 주세요." };
    }

    await logAudit(supabase, uid, "meme_translation.reject", meme.id, input.locale, {
      reason: input.reason.trim(),
      status: translation.status,
    });
    revalidatePath("/admin/translations");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** 큐 화면 전용 삭제 — AI 초안이 쓸 수 없을 때 행 자체를 제거한다(CAS로 동시 수정 방지). */
export async function deleteMemeTranslation(input: {
  memeId: string;
  locale: SeoContentLocale;
  expectedTranslationUpdatedAt: string;
}): Promise<TranslationActionResult> {
  try {
    if (!input.memeId || !isSeoContentLocale(input.locale)) {
      return { ok: false, error: "유효한 밈과 번역 언어가 필요해요." };
    }
    const { supabase, uid } = await requireOperator();
    const { meme, translation } = await loadTranslationContext(
      supabase,
      input.memeId,
      input.locale,
    );

    const { data, error } = await supabase
      .from("meme_translations")
      .delete()
      .eq("meme_id", input.memeId)
      .eq("locale", input.locale)
      .eq("updated_at", input.expectedTranslationUpdatedAt)
      .select("meme_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "번역이 변경되어 삭제하지 못했어요. 새로고침해 주세요." };

    await auditAndRevalidate(
      supabase,
      uid,
      "meme_translation.delete",
      meme,
      input.locale,
      translation.localized_slug,
      { previous_status: translation.status },
    );
    revalidatePath("/admin/translations");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function markMemeTranslationStale(input: {
  memeId: string;
  locale: SeoContentLocale;
  expectedTranslationUpdatedAt: string;
}): Promise<TranslationActionResult> {
  try {
    if (
      !input.memeId ||
      !isSeoContentLocale(input.locale) ||
      !input.expectedTranslationUpdatedAt ||
      !Number.isFinite(Date.parse(input.expectedTranslationUpdatedAt))
    ) {
      return { ok: false, error: "유효한 밈과 번역 언어가 필요해요." };
    }
    const { supabase, uid } = await requireOperator();
    const { meme, translation } = await loadTranslationContext(
      supabase,
      input.memeId,
      input.locale,
    );
    const { data, error } = await supabase
      .from("meme_translations")
      .update({ status: "stale" })
      .eq("meme_id", input.memeId)
      .eq("locale", input.locale)
      .eq("updated_at", input.expectedTranslationUpdatedAt)
      .select("meme_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) {
      return { ok: false, error: "번역이 변경되어 stale로 표시하지 못했어요. 새로고침해 주세요." };
    }

    await auditAndRevalidate(
      supabase,
      uid,
      "meme_translation.mark_stale",
      meme,
      input.locale,
      translation.localized_slug,
      { previous_updated_at: input.expectedTranslationUpdatedAt },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
