"use server";

/**
 * 레인 D — 관리자 콘솔 Server Actions.
 * proxy.ts가 /admin 라우팅을 지키지만, Server Action은 URL과 무관하게 POST로 직접
 * 호출될 수 있으므로 모든 액션에서 is_operator를 재확인한다 (D-1).
 * 감사 로그(admin_audit_log)는 operator INSERT 정책이 없으므로 service-role로 기록한다.
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { PUBLIC_COUNT_CACHE_TAG } from "@/lib/supabase/public-count-cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memePathFrom, type SafetyLevel } from "@/lib/labels";
import type { Json } from "@/lib/database.types";
import { getOEmbed, isSupportedOEmbedUrl } from "@/lib/oembed";
import {
  getOpenAiReviewModel,
  OPENAI_REVIEW_REASONING_EFFORT,
  requestOpenAiStructured,
} from "@/lib/openai-review.server";
import {
  isSeoContentLocale,
  localizedMemePath,
  SEO_CONTENT_LOCALES,
} from "@/lib/i18n-routing";
import {
  HOUSE_ORIGINAL,
  HOUSE_ORIGINAL_RIGHTS_BASIS,
  HOUSE_ORIGINAL_SOURCE_ROLE,
  didHouseOriginalCopyRevertPublish,
  houseOriginalCanonicalUrl,
  houseOriginalOriginLooksLikeOperatorScratch,
  houseOriginalOriginScratchError,
  houseOriginalPublicLabel,
  houseOriginalPublishErrorMessage,
  isHouseOriginal,
} from "@/lib/house-original";
import { getMemeCountry, isMemeCountryCode, type MemeCountryCode } from "@/lib/meme-country";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type UsageContext = Record<"work" | "friends" | "family" | "sns", SafetyLevel>;

type SubmissionApprovalResult =
  | { ok: true; data: { memeId: string; warning?: string } }
  | { ok: false; error: string; createdMemeId?: string };

/** 운영자 인증 확인 — 통과 시 operator 세션 클라이언트와 uid 반환 */
async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) throw new Error("운영자 권한이 없어요.");
  return { supabase, uid: user.id };
}

/** 감사 로그 기록 — service-role 전용 (RLS상 operator 직접 INSERT 불가) */
async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
  if (error) throw new Error("감사 로그 저장에 실패했어요.");
}

async function logAuditOutcome(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  outcome: "intent" | "completed" | "failed",
  detail?: Record<string, unknown>,
) {
  await logAudit(actorId, `${action}.${outcome}`, entityType, entityId, detail);
}

async function finalizeAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>,
) {
  try {
    await logAuditOutcome(
      actorId,
      action,
      entityType,
      entityId,
      "completed",
      detail,
    );
  } catch {
    console.error({ event: "admin_audit_completion_pending", action });
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.";
}

type MemeRevalidationIdentity = {
  short_id: string;
  slug: string;
  origin_kind?: string | null;
  moderation_status?: string | null;
  meme_translations: Array<{ locale: string; localized_slug: string }>;
};

async function loadMemeRevalidationIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memeId: string,
): Promise<MemeRevalidationIdentity | null> {
  const { data, error } = await supabase
    .from("memes")
    .select("short_id, slug, origin_kind, moderation_status, meme_translations(locale, localized_slug)")
    .eq("id", memeId)
    .maybeSingle();
  return error ? null : data;
}

/** 한국어 원문/공개 상태를 소비하는 모든 public artifact를 즉시 갱신한다. */
function revalidateCanonicalMemePaths(meme: MemeRevalidationIdentity | null) {
  revalidateTag(PUBLIC_COUNT_CACHE_TAG, { expire: 0 });
  revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
  const paths = new Set([
    "/",
    "/explore",
    "/search",
    "/rankings",
    "/sitemap.xml",
    "/llms.txt",
    "/llms-full.txt",
  ]);

  for (const locale of SEO_CONTENT_LOCALES) {
    paths.add(`/${locale}`);
    paths.add(`/${locale}/llms.txt`);
    paths.add(`/${locale}/llms-full.txt`);
  }

  if (meme) {
    paths.add(memePathFrom(meme.short_id, meme.slug));
    for (const translation of meme.meme_translations) {
      if (!isSeoContentLocale(translation.locale)) continue;
      paths.add(
        localizedMemePath(
          translation.locale,
          meme.short_id,
          translation.localized_slug,
        ),
      );
    }
  }

  for (const path of paths) revalidatePath(path);
}

function revalidateCountryCardPaths(meme: MemeRevalidationIdentity) {
  for (const path of [
    "/",
    "/global",
    "/explore",
    "/daily",
    "/rankings",
    "/weekly",
    "/timeline",
    "/news",
  ]) {
    revalidatePath(path);
  }
  revalidatePath("/collections/[slug]", "page");
  for (const locale of SEO_CONTENT_LOCALES) {
    revalidatePath(`/${locale}/explore`);
  }
  revalidateCanonicalMemePaths(meme);
}

/* ── 제보 큐 ─────────────────────────────────────────── */

export async function claimSubmission(submissionId: string): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("meme_submissions")
      .update({ claimed_by: uid, status: "reviewing", updated_at: new Date().toISOString() })
      .eq("id", submissionId)
      .eq("status", "pending");
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "submission.claim", "meme_submission", submissionId);
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${submissionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

const REJECT_CATEGORIES = ["중복", "출처 부족", "저작권", "부적절"] as const;
export type RejectCategory = (typeof REJECT_CATEGORIES)[number];

export async function rejectSubmission(input: {
  submissionId: string;
  category: RejectCategory;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!REJECT_CATEGORIES.includes(input.category)) {
      return { ok: false, error: "반려 사유 카테고리를 선택해 주세요." };
    }
    if (!input.reason.trim()) {
      return { ok: false, error: "반려 사유를 입력해 주세요." };
    }
    const { error } = await supabase
      .from("meme_submissions")
      .update({
        status: "rejected",
        reject_reason: `[${input.category}] ${input.reason.trim()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.submissionId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "submission.reject", "meme_submission", input.submissionId, {
      category: input.category,
      reason: input.reason.trim(),
    });
    revalidatePath("/admin/submissions");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

function slugify(title: string): string {
  const s = title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .toLowerCase();
  return s || "밈";
}

export async function approveSubmission(input: {
  submissionId: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  safetyLevel: SafetyLevel;
  category: "phrase" | "dance" | "song" | "image" | "comment" | "challenge";
  difficulty: "beginner" | "normal" | "deep";
  originYear: number | null;
  tags: string[];
  usageContext: UsageContext;
}): Promise<SubmissionApprovalResult> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!input.title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    if (!input.summary.trim()) return { ok: false, error: "한 줄 요약을 입력해 주세요." };

    const { data: submission, error: subErr } = await supabase
      .from("meme_submissions")
      .select("*")
      .eq("id", input.submissionId)
      .single();
    if (subErr || !submission) return { ok: false, error: "제보를 찾을 수 없어요." };
    if (submission.status !== "pending" && submission.status !== "reviewing") {
      return {
        ok: false,
        error: "이미 처리된 제보예요. 제보와 밈 관리에서 처리 결과를 확인해 주세요.",
      };
    }

    // 1) 밈 생성 — 출처가 저장되기 전에는 공개 상태로 전이하지 않는다.
    const baseRow = {
      moderation_status: "pending" as const,
      title: input.title.trim(),
      summary: input.summary.trim(),
      description: input.description.trim(),
      origin: input.origin.trim(),
      safety_level: input.safetyLevel,
      category: input.category,
      difficulty: input.difficulty,
      origin_year: input.originYear,
      usage_context: input.usageContext,
      submitted_by: submission.submitter_id,
    };
    let memeId: string | null = null;
    let revalidationIdentity: MemeRevalidationIdentity | null = null;
    let insertError: string | null = null;
    for (const slug of [slugify(input.title), `${slugify(input.title)}-${Date.now().toString(36)}`]) {
      const { data, error } = await supabase
        .from("memes")
        .insert({ ...baseRow, slug })
        .select("id, short_id, slug")
        .single();
      if (!error && data) {
        memeId = data.id;
        revalidationIdentity = { ...data, meme_translations: [] };
        insertError = null;
        break;
      }
      insertError = error?.message ?? "밈 생성에 실패했어요.";
      if (error?.code !== "23505") break; // slug 중복이 아니면 재시도 의미 없음
    }
    if (!memeId) return { ok: false, error: insertError ?? "밈 생성에 실패했어요." };

    // 2) 제보에 출처가 있으면 pending 밈에 먼저 저장한다.
    if (submission.source_url) {
      let platform = "web";
      try {
        platform = new URL(submission.source_url).hostname.replace(/^www\./, "");
      } catch {
        /* URL 파싱 실패 시 web 유지 */
      }
      let sourceStored = false;
      try {
        const { error } = await supabase.from("meme_sources").insert({
          meme_id: memeId,
          platform,
          source_url: submission.source_url,
        });
        sourceStored = !error;
      } catch {
        // 전송 실패도 pending 밈의 복구 안내로 처리한다.
      }
      if (!sourceStored) {
        return {
          ok: false,
          error: `출처 저장에 실패해 생성된 밈을 대기 상태로 유지했어요. 승인을 다시 실행하지 말고 밈 관리에서 출처를 저장하고 검수를 이어서 처리해 주세요. (밈 ID: ${memeId})`,
          createdMemeId: memeId,
        };
      }
    }

    // 3) 검수 상태 전이 — 트리거가 역행을 차단하므로 순서대로 전진
    for (const status of ["fact_checking", "rights_checking", "approved"] as const) {
      let transitioned = false;
      try {
        const { error } = await supabase
          .from("memes")
          .update({ moderation_status: status, updated_at: new Date().toISOString() })
          .eq("id", memeId);
        transitioned = !error;
      } catch {
        // 응답이 불명확해도 이미 생성된 밈을 다시 만들지 않도록 복구 ID를 반환한다.
      }
      if (!transitioned) {
        return {
          ok: false,
          error: `밈은 생성됐지만 상태 전이(${status})에 실패했어요. 다시 승인하지 말고 밈 관리에서 상태를 확인하고 검수를 이어서 처리해 주세요. (밈 ID: ${memeId})`,
          createdMemeId: memeId,
        };
      }
    }

    if (submission.source_url) {
      // 지원 플랫폼 제보는 승인과 함께 대표 임베드 콘텐츠로 연결한다.
      // 원본 파일을 복제하지 않고 플랫폼의 공식 플레이어만 사용한다.
      if (isSupportedOEmbedUrl(submission.source_url)) {
        try {
          const embed = await getOEmbed(submission.source_url);
          await supabase.from("meme_contents").insert({
            meme_id: memeId,
            platform: embed.provider,
            content_id: embed.contentId,
            type: "embed",
            url: embed.sourceUrl,
            caption: embed.title,
            availability: "live",
            moderation_status: "approved",
            is_representative: true,
          });
        } catch {
          // 플랫폼 일시 장애가 승인 자체를 막지 않도록 출처 링크는 유지한다.
        }
      }
    }

    // 4) 태그 연결
    for (const raw of input.tags) {
      const name = raw.trim();
      if (!name) continue;
      const { data: existing } = await supabase
        .from("tags")
        .select("id")
        .eq("name", name)
        .maybeSingle();
      let tagId = existing?.id ?? null;
      if (!tagId) {
        const { data: created } = await supabase
          .from("tags")
          .insert({ name })
          .select("id")
          .single();
        tagId = created?.id ?? null;
      }
      if (tagId) {
        await supabase
          .from("meme_tags_map")
          .upsert({ meme_id: memeId, tag_id: tagId }, { onConflict: "meme_id,tag_id" });
      }
    }

    // 5) 이미 공개된 밈은 제보/감사 저장 실패로 생성 실패를 반환하지 않는다.
    // 이 작업은 원자적이지 않으므로 복구할 식별자와 재승인 금지 안내를 남긴다.
    const reconciliation: string[] = [];
    let submissionUpdatePending = false;
    try {
      const { data: updatedSubmission, error } = await supabase
        .from("meme_submissions")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", input.submissionId)
        .select("id")
        .maybeSingle();
      submissionUpdatePending = Boolean(error || !updatedSubmission);
    } catch {
      submissionUpdatePending = true;
    }
    if (submissionUpdatePending) {
      reconciliation.push("제보 상태 저장");
      console.error({
        event: "submission_approval_reconciliation_pending",
        submission_id: input.submissionId,
        meme_id: memeId,
        step: "submission_status",
      });
    }

    try {
      await logAudit(uid, "submission.approve", "meme_submission", input.submissionId, {
        meme_id: memeId,
        title: input.title.trim(),
        submission_status_update_pending: submissionUpdatePending,
      });
    } catch {
      reconciliation.push("감사 기록 저장");
      console.error({
        event: "submission_approval_reconciliation_pending",
        submission_id: input.submissionId,
        meme_id: memeId,
        step: "audit",
      });
    }
    const invalidateApproval = () => {
      revalidatePath("/admin/submissions");
      revalidatePath("/admin/memes");
      revalidatePath("/global");
      revalidateCanonicalMemePaths(revalidationIdentity);
    };
    if (reconciliation.length > 0) {
      // 즉시 재검증은 현재 RSC를 갱신해 경고 UI를 제거하므로 응답 후 처리한다.
      try {
        after(() => {
          try {
            invalidateApproval();
          } catch {
            console.error({ event: "submission_approval_cache_revalidation_pending" });
          }
        });
      } catch {
        // 예약 실패도 이미 공개된 밈의 성공 결과를 뒤집지 않는다.
        console.error({ event: "submission_approval_cache_revalidation_pending" });
      }
    } else {
      invalidateApproval();
    }
    return {
      ok: true,
      data: {
        memeId,
        ...(reconciliation.length > 0 ? {
          warning: `밈은 이미 게시됐지만 ${reconciliation.join(" 및 ")}에 실패했어요. 다시 승인하지 말고 제보와 밈 관리에서 저장 상태를 확인해 주세요. (제보 ID: ${input.submissionId}, 밈 ID: ${memeId})`,
        } : {}),
      },
    };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── 밈 관리 ─────────────────────────────────────────── */

export async function createHouseOriginal(input: {
  title: string;
  summary: string;
  description: string;
  origin: string;
  safetyLevel: SafetyLevel;
  category: "phrase" | "dance" | "song" | "image" | "comment" | "challenge";
  difficulty: "beginner" | "normal" | "deep";
  originYear: number | null;
  usageContext: UsageContext;
  country: MemeCountryCode;
  localTitle?: string;
}): Promise<ActionResult<{ memeId: string }>> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!input.title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    if (!input.summary.trim()) return { ok: false, error: "한 줄 요약을 입력해 주세요." };
    if (!isMemeCountryCode(input.country)) return { ok: false, error: "밈 국가를 확인해 주세요." };
    const country = getMemeCountry(input.country);
    if (!country) return { ok: false, error: "밈 국가를 확인해 주세요." };
    if (
      houseOriginalOriginLooksLikeOperatorScratch(input.origin) ||
      houseOriginalOriginLooksLikeOperatorScratch(input.description)
    ) {
      return { ok: false, error: houseOriginalOriginScratchError() };
    }

    const baseRow = {
      title: input.title.trim(),
      summary: input.summary.trim(),
      description: input.description.trim(),
      origin: input.origin.trim(),
      safety_level: input.safetyLevel,
      category: input.category,
      difficulty: input.difficulty,
      origin_year: input.originYear,
      usage_context: input.usageContext,
      origin_kind: HOUSE_ORIGINAL,
      moderation_status: "pending" as const,
    };
    let created: { id: string; short_id: string; slug: string } | null = null;
    let insertError: string | null = null;
    for (const slug of [slugify(input.title), `${slugify(input.title)}-${Date.now().toString(36)}`]) {
      const { data, error } = await supabase
        .from("memes")
        .insert({ ...baseRow, slug })
        .select("id, short_id, slug")
        .single();
      if (!error && data) {
        created = data;
        insertError = null;
        break;
      }
      insertError = error?.message ?? "밈 생성에 실패했어요.";
      if (error?.code !== "23505") break;
    }
    if (!created) {
      return {
        ok: false,
        error: houseOriginalPublishErrorMessage(insertError ?? "밈 생성에 실패했어요."),
      };
    }

    const { error: sourceError } = await supabase.from("meme_sources").insert({
      meme_id: created.id,
      platform: "catchmeme",
      source_url: houseOriginalCanonicalUrl(created.short_id, created.slug),
      title: houseOriginalPublicLabel(),
      creator_name: "CatchMeme",
      copyright_status: "embeddable",
      source_role: HOUSE_ORIGINAL_SOURCE_ROLE,
      rights_basis: HOUSE_ORIGINAL_RIGHTS_BASIS,
    });
    if (sourceError) {
      return {
        ok: false,
        error: `자체 제작 항목은 만들어졌지만 권리 출처 연결에 실패했어요: ${sourceError.message} — 밈 관리에서 이어서 처리해 주세요. (id: ${created.id})`,
      };
    }

    const { error: marketProfileError } = await supabase.from("meme_market_profiles").insert({
      meme_id: created.id,
      market_code: country.code,
      language_tag: country.languageTag,
      role: "origin",
      local_title: input.localTitle?.trim() || input.title.trim(),
      review_state: "reviewed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: uid,
    });
    if (marketProfileError) {
      return {
        ok: false,
        error: `자체 제작 항목과 권리 출처는 만들어졌지만 국가 프로필 연결에 실패했어요: ${marketProfileError.message} — 밈 관리에서 이어서 처리해 주세요. (id: ${created.id})`,
      };
    }

    await logAudit(uid, "meme.create_house_original", "meme", created.id, {
      title: input.title.trim(),
      origin_kind: HOUSE_ORIGINAL,
      moderation_status: "pending",
      country: country.code,
    });
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${created.id}`);
    return { ok: true, data: { memeId: created.id } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function setMemeOriginCountry(input: {
  memeId: string;
  country: MemeCountryCode;
  localTitle: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireOperator();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.memeId)) {
      return { ok: false, error: "밈 식별자를 확인해 주세요." };
    }
    if (!isMemeCountryCode(input.country)) {
      return { ok: false, error: "밈 국가를 확인해 주세요." };
    }
    const localTitle = input.localTitle.trim();
    if (!localTitle || localTitle.length > 300) {
      return { ok: false, error: "현지 제목은 1~300자로 입력해 주세요." };
    }
    const meme = await loadMemeRevalidationIdentity(supabase, input.memeId);
    if (!meme) return { ok: false, error: "밈을 찾을 수 없어요." };

    const { error } = await supabase.rpc("set_meme_origin_country", {
      p_meme_id: input.memeId,
      p_market_code: input.country,
      p_local_title: localTitle,
    });
    if (error) {
      const code = error.message;
      if (code.includes("operator_required")) {
        return { ok: false, error: "운영자 권한이 없어요." };
      }
      if (code.includes("meme_not_found")) {
        return { ok: false, error: "밈을 찾을 수 없어요." };
      }
      if (code.includes("invalid_market_code")) {
        return { ok: false, error: "밈 국가를 확인해 주세요." };
      }
      if (code.includes("invalid_local_title")) {
        return { ok: false, error: "현지 제목은 1~300자로 입력해 주세요." };
      }
      return { ok: false, error: "출처 국가를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
    }

    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidateCountryCardPaths(meme);
    return { ok: true };
  } catch (e) {
    const message = errMessage(e);
    if (message === "로그인이 필요해요." || message === "운영자 권한이 없어요.") {
      return { ok: false, error: message };
    }
    return { ok: false, error: "출처 국가를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}

export async function updateMeme(input: {
  memeId: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string;
  caution: string;
  aliases: string[];
  safetyLevel: SafetyLevel;
  lifecycleStatus: "rising" | "active" | "cooling" | "archived";
  category: "phrase" | "dance" | "song" | "image" | "comment" | "challenge";
  difficulty: "beginner" | "normal" | "deep";
  sentiment: "funny" | "ironic" | "controversial" | "negative" | "wholesome";
  originYear: number | null;
  usageContext: UsageContext;
}): Promise<ActionResult<{ safetyReviewQueued: boolean; revertedToRightsChecking: boolean }>> {
  try {
    const { supabase } = await requireOperator();
    if (!input.title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    const revalidationIdentity = await loadMemeRevalidationIdentity(
      supabase,
      input.memeId,
    );
    if (
      isHouseOriginal(revalidationIdentity?.origin_kind) &&
      (houseOriginalOriginLooksLikeOperatorScratch(input.origin) ||
        houseOriginalOriginLooksLikeOperatorScratch(input.description))
    ) {
      return { ok: false, error: houseOriginalOriginScratchError() };
    }
    const { data: safetyReviewQueued, error } = await supabase.rpc(
      "update_meme_with_safety_review",
      {
        p_meme_id: input.memeId,
        p_proposed_level: input.safetyLevel,
        p_content: {
          title: input.title.trim(),
          summary: input.summary.trim(),
          description: input.description.trim(),
          origin: input.origin.trim(),
          usage_note: input.usageNote.trim() || null,
          caution: input.caution.trim() || null,
          aliases: input.aliases.map((alias) => alias.trim()).filter(Boolean),
          lifecycle_status: input.lifecycleStatus,
          category: input.category,
          difficulty: input.difficulty,
          sentiment: input.sentiment,
          origin_year: input.originYear,
          usage_context: input.usageContext,
        },
      },
    );
    if (error) return { ok: false, error: error.message };
    let revertedToRightsChecking = false;
    if (
      revalidationIdentity &&
      isHouseOriginal(revalidationIdentity.origin_kind) &&
      (revalidationIdentity.moderation_status === "approved" ||
        revalidationIdentity.moderation_status === "limited")
    ) {
      const { data: after } = await supabase
        .from("memes")
        .select("moderation_status")
        .eq("id", input.memeId)
        .maybeSingle();
      revertedToRightsChecking = didHouseOriginalCopyRevertPublish({
        originKind: revalidationIdentity.origin_kind,
        previousStatus: revalidationIdentity.moderation_status,
        nextStatus: after?.moderation_status ?? null,
      });
    }
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidateCanonicalMemePaths(revalidationIdentity);
    return {
      ok: true,
      data: {
        safetyReviewQueued: safetyReviewQueued === true,
        revertedToRightsChecking,
      },
    };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export type KoreanReviewDraft = {
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string;
  caution: string;
  review_basis: "ai_translation" | "korean_wikipedia";
};

type KoreanReviewFields = Omit<KoreanReviewDraft, "review_basis">;

const KOREAN_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "description", "origin", "usage_note", "caution"],
  properties: {
    title: { type: "string", description: "한국어 표기 제목. 고유명사는 원문을 보존" },
    summary: { type: "string", description: "80자 이내의 자연스러운 한국어 한 줄 요약" },
    description: { type: "string", description: "뜻과 쓰임새를 설명하는 한국어 본문" },
    origin: { type: "string", description: "확인된 범위만 반영한 한국어 유래 설명" },
    usage_note: { type: "string", description: "한국어 사용 팁. 원문이 비어 있으면 빈 문자열" },
    caution: { type: "string", description: "한국어 주의 문구. 원문이 비어 있으면 빈 문자열" },
  },
} as const;
export async function generateKoreanReviewDraft(
  memeId: string
): Promise<ActionResult<KoreanReviewDraft>> {
  try {
    const { supabase, uid } = await requireOperator();

    const { data: meme, error } = await supabase
      .from("memes")
      .select("title, summary, description, origin, usage_note, caution")
      .eq("id", memeId)
      .single();
    if (error || !meme) return { ok: false, error: "밈을 찾을 수 없어요." };

    const draft = await requestOpenAiStructured<KoreanReviewFields>({
      name: "korean_review_draft",
      schema: KOREAN_REVIEW_SCHEMA,
      instructions:
        "당신은 한국 밈 사전 서비스 '밈캐치'의 한국어 편집자입니다. " +
        "영어 또는 혼합 언어 항목을 자연스러운 한국어 해요체 검수 초안으로 정리합니다. " +
        "고유명사, 작품명, 인물명, 서비스명은 널리 쓰이는 한국어 표기가 확실할 때만 바꾸고 그렇지 않으면 원문을 보존합니다. " +
        "입력에 없는 사실, 연도, 원출처를 만들지 않습니다. 불확실한 내용은 단정하지 말고 확인이 필요하다고 표시합니다. " +
        "자동 게시나 자동 저장을 하지 않으며 운영자가 사실관계와 고유명사를 최종 확인합니다.",
      input:
        "다음 밈 항목을 한국어 검수 초안으로 정리해 주세요.\n\n" +
        JSON.stringify(meme, null, 2),
    });

    await logAudit(uid, "ai.generate_korean_review", "meme", memeId, {
      model: getOpenAiReviewModel(),
      reasoning_effort: OPENAI_REVIEW_REASONING_EFFORT,
      auto_saved: false,
    });
    return { ok: true, data: { ...draft, review_basis: "ai_translation" } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function transitionMemeStatus(input: {
  memeId: string;
  to: "pending" | "fact_checking" | "rights_checking" | "approved" | "limited" | "rejected";
  attested?: boolean;
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const { data: meme, error: loadError } = await supabase
      .from("memes")
      .select("short_id, slug, origin_kind, meme_translations(locale, localized_slug)")
      .eq("id", input.memeId)
      .maybeSingle();
    if (loadError) return { ok: false, error: loadError.message };
    const revalidationIdentity = meme;

    const publishingHouseOriginal =
      isHouseOriginal(meme?.origin_kind) &&
      (input.to === "approved" || input.to === "limited");

    if (publishingHouseOriginal) {
      if (input.attested !== true) {
        return { ok: false, error: houseOriginalPublishErrorMessage("house_rights_attestation_required") };
      }
      const { error } = await supabase.rpc("publish_house_original", {
        p_meme_id: input.memeId,
        p_to: input.to,
        p_attested: true,
      });
      if (error) {
        return { ok: false, error: houseOriginalPublishErrorMessage(error.message) };
      }
    } else {
      const { error } = await supabase
        .from("memes")
        .update({ moderation_status: input.to, updated_at: new Date().toISOString() })
        .eq("id", input.memeId);
      if (error) {
        const msg = error.message.includes("invalid moderation transition")
          ? "허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요."
          : houseOriginalPublishErrorMessage(error.message);
        return { ok: false, error: msg };
      }
    }

    await logAudit(uid, "meme.transition", "meme", input.memeId, {
      to: input.to,
      attested: publishingHouseOriginal ? true : undefined,
      origin_kind: meme?.origin_kind ?? null,
    });
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidateCanonicalMemePaths(revalidationIdentity);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── 신고 처리 ────────────────────────────────────────── */

export async function handleReport(input: {
  reportId: string;
  action: "resolved" | "dismissed";
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("reports")
      .update({ status: input.action, handled_by: uid })
      .eq("id", input.reportId)
      .eq("status", "open");
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, `report.${input.action}`, "report", input.reportId);
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 신고 대상 댓글 숨김 유지/해제 — discussions에 operator UPDATE 정책이 없어 service-role 사용 */
export async function setDiscussionVisibility(input: {
  discussionId: string;
  status: "visible" | "hidden";
}): Promise<ActionResult> {
  try {
    const { uid } = await requireOperator();
    const admin = createAdminClient();
    const action = "discussion.set_status";
    const detail = { status: input.status };
    await logAuditOutcome(
      uid,
      action,
      "discussion",
      input.discussionId,
      "intent",
      detail,
    );
    const { error } = await (async () => {
      try {
        return await admin
          .from("discussions")
          .update({ status: input.status })
          .eq("id", input.discussionId);
      } catch (cause) {
        await logAuditOutcome(
          uid,
          action,
          "discussion",
          input.discussionId,
          "failed",
          detail,
        );
        throw cause;
      }
    })();
    if (error) {
      await logAuditOutcome(
        uid,
        action,
        "discussion",
        input.discussionId,
        "failed",
        detail,
      );
      return { ok: false, error: error.message };
    }
    await finalizeAudit(
      uid,
      action,
      "discussion",
      input.discussionId,
      detail,
    );
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export type DraftResult = {
  summary: string;
  description: string;
  origin: string;
  safety_level: SafetyLevel;
  usage_context: UsageContext;
};

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "description", "origin", "safety_level", "usage_context"],
  properties: {
    summary: { type: "string", description: "80자 이내 한 줄 요약 (해요체)" },
    description: { type: "string", description: "뜻과 쓰임새 설명 2~3문단 (해요체)" },
    origin: { type: "string", description: "유래·확산 경로 1~2문단 (해요체)" },
    safety_level: { type: "string", enum: ["green", "yellow", "gray", "red"] },
    usage_context: {
      type: "object",
      additionalProperties: false,
      required: ["work", "friends", "family", "sns"],
      properties: {
        work: { type: "string", enum: ["green", "yellow", "gray", "red"] },
        friends: { type: "string", enum: ["green", "yellow", "gray", "red"] },
        family: { type: "string", enum: ["green", "yellow", "gray", "red"] },
        sns: { type: "string", enum: ["green", "yellow", "gray", "red"] },
      },
    },
  },
} as const;

export async function generateDraft(submissionId: string): Promise<ActionResult<DraftResult>> {
  try {
    const { supabase, uid } = await requireOperator();

    const { data: submission } = await supabase
      .from("meme_submissions")
      .select("name, source_url, description, seen_at, guess_reason, tags")
      .eq("id", submissionId)
      .single();
    if (!submission) return { ok: false, error: "제보를 찾을 수 없어요." };

    const userPrompt = [
      `밈 이름: ${submission.name}`,
      submission.source_url ? `출처 링크: ${submission.source_url}` : null,
      submission.seen_at ? `제보자가 본 곳: ${submission.seen_at}` : null,
      submission.description ? `제보자 설명: ${submission.description}` : null,
      submission.guess_reason ? `유행 이유 추측: ${submission.guess_reason}` : null,
      submission.tags.length ? `태그: ${submission.tags.join(", ")}` : null,
      "",
      "위 제보를 바탕으로 밈 사전 초안을 JSON으로 작성해 주세요.",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const draft = await requestOpenAiStructured<DraftResult>({
      name: "meme_submission_review_draft",
      schema: DRAFT_SCHEMA,
      instructions:
        "당신은 한국 밈 사전 서비스 '밈캐치'의 운영 보조입니다. 제보된 밈 정보를 바탕으로 한국어 검수 초안을 작성합니다. " +
        "제보가 영어 또는 혼합 언어이면 먼저 의미를 자연스러운 한국어로 해석하고, 불가피한 고유명사를 제외한 출력은 모두 한국어 해요체로 작성합니다. " +
        "입력에 없는 사실, 연도, 원출처를 만들지 않고 확실하지 않은 내용은 확인 필요성을 표시합니다. " +
        "safety_level 기준: green=써도 됨, yellow=맥락 주의, gray=이미 유행이 지남, red=쓰면 위험(차별·혐오·논란). " +
        "usage_context는 직장(work)·친구(friends)·가족(family)·공개 SNS(sns) 각각에서의 사용 안전도를 같은 기준으로 판단합니다. " +
        "자동 게시나 자동 저장을 하지 않으며 운영자가 최종 사실관계와 저작권을 확인합니다.",
      input: userPrompt,
    });

    await logAudit(uid, "ai.generate_draft", "meme_submission", submissionId, {
      model: getOpenAiReviewModel(),
      reasoning_effort: OPENAI_REVIEW_REASONING_EFFORT,
    });
    return { ok: true, data: draft };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ── MemeCatch Plus 수동 권한 관리 (운영자 전용) ─────────────────────
// 조회/부여 모두 service-role RPC를 쓰되(다른 사용자 구독 열람은 RLS로 막혀 있음),
// 호출 전 requireOperator로 운영자를 재확인하고 부여/해제는 감사 로그에 남긴다.

export type PlusStatusView = {
  userFound: boolean;
  userId?: string;
  email: string;
  hasBillingIdentity?: boolean;
  isPremium?: boolean;
  status?: string | null;
  currentPeriodEnd?: string | null;
  lastEventAt?: string | null;
  amount?: number | null;
  isManual?: boolean | null;
  provider?: string | null;
  subscriptions?: {
    provider: string;
    status: string;
    amount: number | null;
    currentPeriodEnd: string | null;
    lastEventAt: string | null;
    isManual: boolean;
  }[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 이메일로 Plus 상태 조회 — 부작용 없음 */
export async function lookupPlusStatus(
  email: string
): Promise<ActionResult<PlusStatusView>> {
  try {
    await requireOperator();
    const normalized = normalizeEmail(email);
    if (!normalized || normalized.indexOf("@") < 1) {
      return { ok: false, error: "이메일을 입력해 주세요." };
    }
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("admin_get_plus_status", {
      p_email: normalized,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as unknown as PlusStatusView };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 이메일 사용자에게 Plus 수동 부여(active=true, months 시한부) 또는 해제(active=false) */
export async function setUserPlus(input: {
  email: string;
  active: boolean;
  months?: number;
}): Promise<ActionResult<PlusStatusView>> {
  try {
    const { uid } = await requireOperator();
    const normalized = normalizeEmail(input.email);
    if (!normalized || normalized.indexOf("@") < 1) {
      return { ok: false, error: "이메일을 입력해 주세요." };
    }
    const months = input.active
      ? Math.max(1, Math.min(Math.trunc(input.months ?? 1), 36))
      : 1;
    const admin = createAdminClient();
    const action = input.active ? "plus.grant" : "plus.revoke";
    const detail = { email: normalized, active: input.active, months };
    await logAuditOutcome(
      uid,
      action,
      "billing_subscription",
      null,
      "intent",
      detail,
    );
    const { data, error } = await (async () => {
      try {
        return await admin.rpc("admin_set_plus_entitlement", {
          p_email: normalized,
          p_active: input.active,
          p_months: months,
        });
      } catch (cause) {
        await logAuditOutcome(
          uid,
          action,
          "billing_subscription",
          null,
          "failed",
          detail,
        );
        throw cause;
      }
    })();
    if (error) {
      await logAuditOutcome(
        uid,
        action,
        "billing_subscription",
        null,
        "failed",
        detail,
      );
      const msg = error.message.includes("user_not_found")
        ? "해당 이메일의 가입 계정을 찾을 수 없어요. (사용자가 먼저 로그인·가입해야 해요.)"
        : error.message.includes("invalid_email")
          ? "이메일 형식이 올바르지 않아요."
          : error.message;
      return { ok: false, error: msg };
    }
    const result = data as { userId?: string } | null;
    await finalizeAudit(
      uid,
      action,
      "billing_subscription",
      result?.userId ?? null,
      detail,
    );
    revalidatePath("/admin/subscriptions");
    const { data: latest } = await admin.rpc("admin_get_plus_status", {
      p_email: normalized,
    });
    return { ok: true, data: latest as unknown as PlusStatusView };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
