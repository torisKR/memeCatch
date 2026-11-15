"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flags } from "@/lib/flags";
import { getOEmbed, isSupportedOEmbedUrl } from "@/lib/oembed";
import { getRequestLocale } from "@/lib/i18n-server";
import { SUBMIT_COPY, type SubmitCopy } from "@/lib/i18n-submit";

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

type SubmissionQuotaRpc = (
  name: "reserve_submission_attempt",
) => PromiseLike<{ error: { code?: string } | null }>;

function createSubmitSchema(copy: SubmitCopy) {
  const { errors } = copy;
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, errors.nameRequired)
      .max(100, errors.nameTooLong),
    seenAt: z.string().trim().max(200, errors.seenAtTooLong),
    sourceUrl: z
      .string()
      .trim()
      .max(500, errors.sourceUrlTooLong)
      .refine(
        (value) => value === "" || /^https:\/\/\S+\.\S+/.test(value),
        errors.sourceUrlInvalid,
      ),
    description: z.string().trim().max(2000, errors.descriptionTooLong),
    guessReason: z.string().trim().max(1000, errors.guessTooLong),
    tags: z.string().trim().max(300, errors.tagsTooLong),
    attachmentPath: z
      .string()
      .trim()
      .max(300, errors.attachmentTooLong)
      .optional()
      .default(""),
  });
}

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 30),
    ),
  ).slice(0, 10);
}

/**
 * 이미지 첨부를 지원하는 제보 액션 — submit_meme_v2 RPC 호출.
 * 첨부가 없으면 p_attachment_path=null 로 기존과 동일하게 동작.
 */
export async function submitMemeWithAttachment(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const copy = SUBMIT_COPY[await getRequestLocale()];
  if (!flags.submissionsOpen) {
    return {
      status: "error",
      fieldErrors: {},
      formError: copy.errors.submissionsClosed,
    };
  }

  const parsed = createSubmitSchema(copy).safeParse({
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
      formError: copy.errors.loginRequired,
    };
  }

  const {
    name,
    seenAt,
    sourceUrl,
    description,
    guessReason,
    tags,
    attachmentPath,
  } = parsed.data;

  if (
    attachmentPath !== "" &&
    !attachmentPath.startsWith(`meme-uploads/${user.id}/`)
  ) {
    return {
      status: "error",
      fieldErrors: { attachment: copy.errors.attachmentInvalid },
    };
  }

  const { error: quotaError } = await (supabase.rpc as unknown as SubmissionQuotaRpc)(
    "reserve_submission_attempt",
  );
  if (quotaError) {
    return {
      status: "error",
      fieldErrors: {},
      formError: quotaError.code === "P0429" ? copy.errors.rateLimited : copy.errors.submitFailed,
    };
  }

  // 지원 플랫폼 링크는 미리보기와 동일한 서버 검증을 다시 수행한다.
  // 클라이언트 미리보기는 우회될 수 있으므로 제출 시점을 신뢰 경계로 삼는다.
  if (sourceUrl && isSupportedOEmbedUrl(sourceUrl)) {
    try {
      await getOEmbed(sourceUrl);
    } catch {
      return {
        status: "error",
        fieldErrors: { sourceUrl: copy.errors.sourceUnavailable },
      };
    }
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
        formError: copy.errors.rateLimited,
      };
    }
    if (error.message.includes("invalid_url")) {
      return {
        status: "error",
        fieldErrors: { sourceUrl: copy.errors.sourceUrlInvalid },
      };
    }
    if (error.message.includes("invalid_attachment_path")) {
      return {
        status: "error",
        fieldErrors: {
          attachment: copy.errors.attachmentInvalid,
        },
      };
    }
    if (error.message.includes("login_required")) {
      return {
        status: "error",
        fieldErrors: {},
        formError: copy.errors.loginRequired,
      };
    }
    return {
      status: "error",
      fieldErrors: {},
      formError: copy.errors.submitFailed,
    };
  }

  return { status: "success", submissionId: data as string };
}
