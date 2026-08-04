"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import {
  isSeoContentLocale,
  localizedMemePath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "operator") throw new Error("운영자 권한이 없어요.");
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

const TRANSLATION_QUEUE_PAGE_SIZE = 10;

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
