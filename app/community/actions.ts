"use server";

/**
 * 레인 3 — 커뮤니티 서버 액션 (zod 검증 → security definer RPC).
 * 테이블 직접 INSERT는 RLS 기본 거부 — 쓰기는 전부 RPC 경유.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommunityActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      error:
        | "invalid_input"
        | "login_required"
        | "rate_limited"
        | "not_found"
        | "server_error";
      message: string;
    };

function mapRpcError(err: { message?: string; code?: string }): Extract<
  CommunityActionResult,
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
      message:
        "잠깐만요 — 짧은 시간에 너무 많이 작성했어요. 잠시 후 다시 시도해 주세요.",
    };
  }
  if (msg.includes("post_not_found")) {
    return {
      ok: false,
      error: "not_found",
      message: "글을 찾을 수 없어요. 삭제됐을 수 있어요.",
    };
  }
  return {
    ok: false,
    error: "server_error",
    message: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
  };
}

// ── 글 작성 ───────────────────────────────────────────────
const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "제목은 2자 이상 써 주세요.")
    .max(100, "제목은 100자까지 쓸 수 있어요."),
  body: z
    .string()
    .trim()
    .min(1, "내용을 입력해 주세요.")
    .max(5000, "5,000자까지 쓸 수 있어요."),
  memeId: z.uuid().nullable().optional(),
});

export async function createCommunityPost(
  input: z.input<typeof createPostSchema>
): Promise<CommunityActionResult<{ postId: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_community_post", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_meme_id: parsed.data.memeId ?? undefined,
  });
  if (error) return mapRpcError(error);
  revalidatePath("/community");
  return { ok: true, data: { postId: data as string } };
}

// ── 댓글 작성 ─────────────────────────────────────────────
const createCommentSchema = z.object({
  postId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "내용을 입력해 주세요.")
    .max(1000, "1,000자까지 쓸 수 있어요."),
});

export async function createCommunityComment(
  input: z.input<typeof createCommentSchema>
): Promise<CommunityActionResult<{ commentId: string }>> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_community_comment", {
    p_post_id: parsed.data.postId,
    p_body: parsed.data.body,
  });
  if (error) return mapRpcError(error);
  revalidatePath(`/community/${parsed.data.postId}`);
  return { ok: true, data: { commentId: data as string } };
}
