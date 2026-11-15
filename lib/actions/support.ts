"use server";

/**
 * 고객센터 — 사용자 문의 작성 Server Action.
 * RLS(본인 명의 insert)와 DB 트리거(24시간 10건, P0429)가 최종 방어선이고,
 * 여기서는 zod 검증과 친절한 에러 메시지를 담당한다.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INQUIRY_CATEGORIES } from "@/lib/support";

export type SupportActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_input" | "login_required" | "rate_limited" | "server_error";
      message: string;
    };

const createInquirySchema = z.object({
  category: z.enum(INQUIRY_CATEGORIES),
  subject: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(120, "제목은 120자까지 쓸 수 있어요."),
  body: z
    .string()
    .trim()
    .min(10, "내용을 10자 이상 적어 주세요.")
    .max(2000, "내용은 2,000자까지 쓸 수 있어요."),
});

export async function createInquiry(
  input: z.input<typeof createInquirySchema>
): Promise<SupportActionResult> {
  const parsed = createInquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "login_required",
      message: "로그인이 필요해요. 쓰던 내용은 저장해 둘게요.",
    };
  }

  const { error } = await supabase.from("support_inquiries").insert({
    user_id: user.id,
    category: parsed.data.category,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  if (error) {
    if (error.message.includes("rate_limited") || error.code === "P0429") {
      return {
        ok: false,
        error: "rate_limited",
        message: "하루에 보낼 수 있는 문의 수를 넘었어요. 내일 다시 시도해 주세요.",
      };
    }
    return {
      ok: false,
      error: "server_error",
      message: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  revalidatePath("/support");
  return { ok: true };
}
