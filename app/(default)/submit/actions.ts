"use server";

import { z } from "zod";
import { createClient } from "@/lib/db/server";
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

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
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

  const { error: quotaError } = await (db.rpc as unknown as SubmissionQuotaRpc)(
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
  } as unknown as Parameters<typeof db.rpc<"submit_meme_v2">>[1];
  const { data, error } = await db.rpc("submit_meme_v2", rpcArgs);

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

/* ── 밈 상세 보강 제보(출처 링크·사용 예문) ───────────────── */

export type ContributionKind = "source" | "example";

export type ContributionInput = {
  memeId: string;
  kind: ContributionKind;
  sourceUrl?: string;
  note?: string;
  situation?: string;
  text?: string;
  creditPublic?: boolean;
};

export type ContributionResult =
  | { ok: true }
  | { ok: false; error: "login_required" | "invalid" | "closed" | "duplicate" | "rate_limited" | "failed"; message: string };

const contributionSchema = z.discriminatedUnion("kind", [
  z.object({
    memeId: z.uuid(),
    kind: z.literal("source"),
    sourceUrl: z
      .string()
      .trim()
      .max(500, "링크는 500자까지 넣을 수 있어요.")
      .regex(/^https:\/\/\S+\.\S+$/, "https://로 시작하는 링크를 넣어 주세요."),
    note: z.string().trim().max(300, "설명은 300자까지 쓸 수 있어요.").optional().default(""),
    creditPublic: z.boolean().optional().default(true),
  }),
  z.object({
    memeId: z.uuid(),
    kind: z.literal("example"),
    situation: z
      .string()
      .trim()
      .min(1, "어떤 상황에서 썼는지 적어 주세요.")
      .max(120, "상황은 120자까지 쓸 수 있어요."),
    text: z
      .string()
      .trim()
      .min(1, "실제로 쓴 문장을 적어 주세요.")
      .max(500, "예문은 500자까지 쓸 수 있어요."),
    creditPublic: z.boolean().optional().default(true),
  }),
]);

/**
 * 밈 상세의 인라인 보강 제보 — submit_meme_contribution RPC.
 * 새 밈 제보(meme_submissions)와 큐를 나눠, 승인해도 새 밈이 생기지 않고 이 밈에만 붙는다.
 */
export async function submitMemeContribution(
  input: ContributionInput,
): Promise<ContributionResult> {
  if (!flags.submissionsOpen) {
    return { ok: false, error: "closed", message: "지금은 제보를 잠시 받지 않고 있어요." };
  }
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }
  const data = parsed.data;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "login_required", message: "로그인하면 제보할 수 있어요." };
  }

  const isSource = data.kind === "source";
  const { error } = await db.rpc("submit_meme_contribution", {
    p_meme_id: data.memeId,
    p_kind: data.kind,
    p_source_url: isSource ? data.sourceUrl : null,
    p_note: isSource && data.note ? data.note : null,
    p_situation: isSource ? null : data.situation,
    p_text: isSource ? null : data.text,
    p_credit_public: data.creditPublic,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("login_required")) {
      return { ok: false, error: "login_required", message: "로그인하면 제보할 수 있어요." };
    }
    if (error.code === "P0429" || message.includes("rate_limited")) {
      return { ok: false, error: "rate_limited", message: "제보가 많아 잠시 쉬어 가요. 1시간 뒤에 다시 보내 주세요." };
    }
    if (message.includes("already_linked")) {
      return { ok: false, error: "duplicate", message: "이미 이 문서에 연결된 링크예요." };
    }
    if (message.includes("already_pending")) {
      return { ok: false, error: "duplicate", message: "같은 링크가 이미 검토를 기다리고 있어요." };
    }
    if (message.includes("invalid_url")) {
      return { ok: false, error: "invalid", message: "https://로 시작하는 링크를 넣어 주세요." };
    }
    return { ok: false, error: "failed", message: "제보를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }

  return { ok: true };
}
