"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type RadarSafetyActionResult =
  | { ok: true }
  | { ok: false; error: string };

const reviewSchema = z.object({
  reviewId: z.uuid("올바른 검수 ID가 아니에요."),
  decision: z.enum(["approved", "rejected"], {
    error: "승인 또는 반려를 선택해 주세요.",
  }),
  reviewNote: z
    .string()
    .trim()
    .min(1, "검수 메모를 입력해 주세요.")
    .max(2000, "검수 메모는 2,000자까지 쓸 수 있어요."),
});

class ActionError extends Error {}

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionError("로그인이 필요해요.");

  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) {
    throw new ActionError("운영자 권한이 없어요.");
  }

  return { supabase, uid: user.id };
}

function errorMessage(error: unknown): string {
  return error instanceof ActionError
    ? error.message
    : "안전 등급 검수 처리에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

export async function applyRadarSafetyReview(input: {
  reviewId: string;
  decision: string;
  reviewNote: string;
}): Promise<RadarSafetyActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  try {
    const { supabase } = await requireOperator();
    const { data: applied, error } = await supabase.rpc("apply_safety_review", {
      p_review_id: parsed.data.reviewId,
      p_decision: parsed.data.decision,
      p_review_note: parsed.data.reviewNote,
    });
    if (error) throw new ActionError("안전 등급 검수 처리에 실패했어요.");
    if (applied !== true) {
      return { ok: false, error: "이미 처리된 검수 요청이에요." };
    }
    if (parsed.data.decision === "approved") {
      revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
    }
    revalidatePath("/admin/radar-safety");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
