"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flags } from "@/lib/flags";

export type SubmitFieldErrors = Partial<
  Record<
    | "name"
    | "seenAt"
    | "sourceUrl"
    | "description"
    | "guessReason"
    | "tags"
    | "attachment",
    string
  >
>;

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; fieldErrors: SubmitFieldErrors; formError?: string }
  | { status: "success"; submissionId: string };

const submitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "밈 이름을 입력해 주세요")
    .max(100, "이름은 100자 이내로 입력해 주세요"),
  seenAt: z.string().trim().max(200, "200자 이내로 입력해 주세요"),
  sourceUrl: z
    .string()
    .trim()
    .max(500, "링크가 너무 길어요")
    .refine(
      (v) => v === "" || /^https:\/\/\S+\.\S+/.test(v),
      "https:// 로 시작하는 링크만 넣을 수 있어요"
    ),
  description: z.string().trim().max(2000, "설명은 2000자 이내로 입력해 주세요"),
  guessReason: z.string().trim().max(1000, "1000자 이내로 입력해 주세요"),
  tags: z.string().trim().max(300, "태그가 너무 길어요"),
  attachmentPath: z.string().trim().max(300).optional().default(""),
});

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 30)
    )
  ).slice(0, 10);
}

/**
 * 이미지 첨부를 지원하는 제보 액션 — submit_meme_v2 RPC 호출.
 * 첨부가 없으면 p_attachment_path=null 로 기존과 동일하게 동작.
 */
export async function submitMemeWithAttachment(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  if (!flags.submissionsOpen) {
    return {
      status: "error",
      fieldErrors: {},
      formError: "지금은 제보를 받지 않아요. 조금만 기다려 주세요",
    };
  }

  const parsed = submitSchema.safeParse({
    name: formData.get("name") ?? "",
    seenAt: formData.get("seenAt") ?? "",
    sourceUrl: formData.get("sourceUrl") ?? "",
    description: formData.get("description") ?? "",
    guessReason: formData.get("guessReason") ?? "",
    tags: formData.get("tags") ?? "",
    attachmentPath: formData.get("attachmentPath") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: SubmitFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof SubmitFieldErrors | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      fieldErrors: {},
      formError: "로그인이 필요해요. 로그인 후 다시 시도해 주세요",
    };
  }

  const { name, seenAt, sourceUrl, description, guessReason, tags, attachmentPath } =
    parsed.data;

  // 첨부 경로는 자기 폴더 프리픽스만 허용 (RPC에서도 재검증)
  if (
    attachmentPath !== "" &&
    !attachmentPath.startsWith(`meme-uploads/${user.id}/`)
  ) {
    return {
      status: "error",
      fieldErrors: {
        attachment: "첨부 이미지 정보가 올바르지 않아요. 이미지를 다시 올려 주세요",
      },
    };
  }

  // p_seen_at/p_url/p_guess는 SQL에서 nullable text지만 생성 타입은 string으로 좁혀짐 — null 전달은 유효
  const rpcArgs = {
    p_name: name,
    p_seen_at: seenAt === "" ? null : seenAt,
    p_url: sourceUrl === "" ? null : sourceUrl,
    p_description: description,
    p_guess: guessReason === "" ? null : guessReason,
    p_tags: parseTags(tags),
    p_attachment_path: attachmentPath === "" ? null : attachmentPath,
  } as unknown as Parameters<typeof supabase.rpc<"submit_meme_v2">>[1];
  const { data, error } = await supabase.rpc("submit_meme_v2", rpcArgs);

  if (error) {
    if (error.code === "P0429") {
      return {
        status: "error",
        fieldErrors: {},
        formError:
          "너무 빨라요 — 제보는 1시간에 5개까지만 보낼 수 있어요. 잠시 후 다시 시도해 주세요",
      };
    }
    if (error.message.includes("invalid_url")) {
      return {
        status: "error",
        fieldErrors: { sourceUrl: "https:// 로 시작하는 링크만 넣을 수 있어요" },
      };
    }
    if (error.message.includes("invalid_attachment_path")) {
      return {
        status: "error",
        fieldErrors: {
          attachment: "첨부 이미지 정보가 올바르지 않아요. 이미지를 다시 올려 주세요",
        },
      };
    }
    if (error.message.includes("login_required")) {
      return {
        status: "error",
        fieldErrors: {},
        formError: "로그인이 필요해요. 로그인 후 다시 시도해 주세요",
      };
    }
    return {
      status: "error",
      fieldErrors: {},
      formError: "제보 접수에 실패했어요. 잠시 후 다시 시도해 주세요",
    };
  }

  return { status: "success", submissionId: data as string };
}
