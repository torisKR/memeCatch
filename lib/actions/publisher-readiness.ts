"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Json } from "@/lib/database.types";
import {
  PUBLISHER_REVIEW_CHECKLIST_KEYS,
  publisherReadinessFingerprint,
  type PublisherReadinessRow,
  type PublisherReviewChecklist,
} from "@/lib/publisher-readiness";
import { PUBLISHER_READINESS_SELECT } from "@/lib/publisher-readiness.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublisherReadinessReviewActionResult =
  | { ok: true }
  | { ok: false; error: string };

const reviewInputSchema = z.object({
  memeId: z.uuid("올바른 밈 ID가 아니에요."),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/, "올바른 문서 지문이 아니에요."),
  checklist: z.object({
    meaningContext: z.boolean(),
    sourceClaims: z.boolean(),
    rightsDelivery: z.boolean(),
    safetyContext: z.boolean(),
    ownHumanValue: z.boolean(),
  }),
  note: z.string().trim().min(10, "검수 근거를 10자 이상 남겨 주세요.").max(2000, "검수 메모는 2,000자까지 쓸 수 있어요."),
});

class ActionError extends Error {}

async function requireOperator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ActionError("로그인이 필요해요.");
  const { data: isOperator, error } = await supabase.rpc("is_operator");
  if (error || isOperator !== true) throw new ActionError("운영자 권한이 없어요.");
  return { supabase, uid: user.id };
}

function errorMessage(error: unknown): string {
  return error instanceof ActionError
    ? error.message
    : "퍼블리셔 검수 기록 저장에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

export async function recordPublisherReadinessReview(input: {
  memeId: string;
  expectedFingerprint: string;
  checklist: PublisherReviewChecklist;
  note: string;
}): Promise<PublisherReadinessReviewActionResult> {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }
  if (!PUBLISHER_REVIEW_CHECKLIST_KEYS.every((key) => parsed.data.checklist[key] === true)) {
    return { ok: false, error: "모든 확인 항목을 직접 검토한 뒤 기록해 주세요." };
  }

  try {
    const { supabase, uid } = await requireOperator();
    const { data, error } = await supabase
      .from("memes")
      .select(PUBLISHER_READINESS_SELECT)
      .eq("id", parsed.data.memeId)
      .single<PublisherReadinessRow>();
    if (error || !data) throw new ActionError("현재 공개 문서를 다시 불러오지 못했어요.");
    if (data.moderation_status !== "approved" && data.moderation_status !== "limited") {
      throw new ActionError("현재 공개 대상 문서만 퍼블리셔 검수를 기록할 수 있어요.");
    }

    const currentFingerprint = publisherReadinessFingerprint(data);
    if (currentFingerprint !== parsed.data.expectedFingerprint) {
      throw new ActionError("검수 화면을 연 뒤 문서가 변경됐어요. 새로고침 후 다시 확인해 주세요.");
    }

    const detail = {
      version: 1,
      fingerprint: currentFingerprint,
      checklist: parsed.data.checklist,
      note: parsed.data.note,
    };
    const admin = createAdminClient();
    const { error: auditError } = await admin.from("admin_audit_log").insert({
      actor_id: uid,
      action: "publisher.readiness.review",
      entity_type: "meme",
      entity_id: parsed.data.memeId,
      detail: detail as Json,
    });
    if (auditError) throw new ActionError("퍼블리셔 검수 기록 저장에 실패했어요.");

    revalidatePath("/admin/publisher-readiness");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
