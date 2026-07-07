"use server";

/**
 * 레인 F — 커뮤니티 서버 액션 (zod 검증 → RPC 호출).
 * 쓰기는 전부 security definer RPC 경유 (테이블 직접 INSERT는 RLS 기본 거부).
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flags } from "@/lib/flags";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      error:
        | "invalid_input"
        | "login_required"
        | "rate_limited"
        | "community_disabled"
        | "duplicate"
        | "server_error";
      message: string;
    };

function mapRpcError(err: { message?: string; code?: string }): Extract<
  ActionResult,
  { ok: false }
> {
  const msg = err.message ?? "";
  if (msg.includes("login_required")) {
    return {
      ok: false,
      error: "login_required",
      message: "로그인이 필요해요. 쓰던 내용은 저장해 둘게요.",
    };
  }
  if (msg.includes("rate_limited") || err.code === "P0429") {
    return {
      ok: false,
      error: "rate_limited",
      message: "잠깐만요 — 짧은 시간에 너무 많이 작성했어요. 잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    ok: false,
    error: "server_error",
    message: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
  };
}

const DISABLED: Extract<ActionResult, { ok: false }> = {
  ok: false,
  error: "community_disabled",
  message: "커뮤니티 기능은 아직 준비 중이에요.",
};

// ── 댓글 작성 ─────────────────────────────────────────────
const postCommentSchema = z.object({
  memeId: z.uuid(),
  parentId: z.uuid().nullable().optional(),
  body: z.string().trim().min(1, "내용을 입력해 주세요.").max(2000, "2,000자까지 쓸 수 있어요."),
});

export async function postComment(
  input: z.input<typeof postCommentSchema>
): Promise<ActionResult<{ commentId: string }>> {
  if (!flags.communityEnabled) return DISABLED;
  const parsed = postCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_comment", {
    p_meme_id: parsed.data.memeId,
    // SQL 시그니처상 3인자 필수 — 최상위 댓글은 null 전달 (생성 타입이 string이라 캐스팅)
    p_parent_id: (parsed.data.parentId ?? null) as unknown as string,
    p_body: parsed.data.body,
  });
  if (error) return mapRpcError(error);
  return { ok: true, data: { commentId: data as string } };
}

// ── 신고 ─────────────────────────────────────────────────
const fileReportSchema = z.object({
  targetType: z.enum(["meme", "discussion", "submission"]),
  targetId: z.uuid(),
  reason: z.string().trim().min(1, "신고 사유를 입력해 주세요.").max(500, "500자까지 쓸 수 있어요."),
});

export async function reportContent(
  input: z.input<typeof fileReportSchema>
): Promise<ActionResult> {
  // 신고는 안전장치라 플래그와 무관하게 허용
  const parsed = fileReportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("file_report", {
    p_target: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
  });
  if (error) return mapRpcError(error);
  return { ok: true, data: null };
}

// ── 세대별 투표 ────────────────────────────────────────────
const castVoteSchema = z.object({
  memeId: z.uuid(),
  ageGroup: z.enum(["10s", "20s", "30s", "40s", "50s+"]),
  vote: z.enum(["know", "dont_know", "use", "wont_use"]),
});

export async function castGenerationVote(
  input: z.input<typeof castVoteSchema>
): Promise<ActionResult> {
  if (!flags.communityEnabled) return DISABLED;
  const parsed = castVoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_generation_vote", {
    p_meme_id: parsed.data.memeId,
    p_age_group: parsed.data.ageGroup,
    p_vote: parsed.data.vote,
  });
  if (error) return mapRpcError(error);

  // 연령대 미설정 프로필이면 이번 응답을 기억 (실패해도 투표는 성공 처리)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("age_group")
      .eq("id", user.id)
      .single();
    if (profile && profile.age_group == null) {
      await supabase
        .from("profiles")
        .update({ age_group: parsed.data.ageGroup })
        .eq("id", user.id);
    }
  }
  return { ok: true, data: null };
}
