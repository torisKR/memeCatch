"use server";

/**
 * 관리자 콘솔 — 고객센터 문의 답변/상태 관리 Server Actions.
 * Server Action은 URL과 무관하게 직접 POST될 수 있으므로 모든 액션에서
 * operator를 재확인한다(lib/actions/admin.ts와 동일한 D-1 원칙).
 * 감사 로그는 service-role로 기록(admin_audit_log에 operator INSERT 정책 없음).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * 사용자에게 그대로 보여줘도 안전한, 의도적으로 던진 에러.
 * 이 타입이 아닌 예외(DB 드라이버 에러 등)는 내부 정보가 섞일 수 있으므로
 * errMessage()에서 일반 메시지로 대체한다.
 */
class ActionError extends Error {}

/** 운영자 인증 확인 — 통과 시 operator 세션 클라이언트와 uid 반환 */
async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionError("로그인이 필요해요.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "operator") throw new ActionError("운영자 권한이 없어요.");
  return { supabase, uid: user.id };
}

async function logAudit(
  actorId: string,
  action: string,
  entityId: string,
  detail?: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "support_inquiry",
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
}

/** ActionError만 그대로 노출, 그 외 예외는 내부 정보 유출 방지를 위해 일반화 */
function errMessage(e: unknown): string {
  return e instanceof ActionError ? e.message : "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

function revalidateInquiryPaths() {
  revalidatePath("/admin/inquiries");
  revalidatePath("/support");
}

// ── 답변 저장(상태 → answered) ────────────────────────────
const answerSchema = z.object({
  inquiryId: z.uuid(),
  reply: z
    .string()
    .trim()
    .min(1, "답변 내용을 입력해 주세요.")
    .max(4000, "답변은 4,000자까지 쓸 수 있어요."),
});

export async function answerInquiry(
  input: z.input<typeof answerSchema>
): Promise<ActionResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("support_inquiries")
      .update({
        admin_reply: parsed.data.reply,
        status: "answered",
        replied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.inquiryId);
    if (error) throw new ActionError("답변 저장에 실패했어요.");
    await logAudit(uid, "inquiry_answer", parsed.data.inquiryId, {
      reply_length: parsed.data.reply.length,
    });
    revalidateInquiryPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ── 상태 변경(종료/다시 열기) ─────────────────────────────
const statusSchema = z.object({
  inquiryId: z.uuid(),
  status: z.enum(["open", "closed"]),
});

export async function setInquiryStatus(
  input: z.input<typeof statusSchema>
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "입력값을 확인해 주세요." };
  }
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("support_inquiries")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.inquiryId);
    if (error) throw new ActionError("상태 변경에 실패했어요.");
    await logAudit(uid, `inquiry_${parsed.data.status}`, parsed.data.inquiryId);
    revalidateInquiryPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
