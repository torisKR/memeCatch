"use server";

/**
 * 레인 D — 관리자 콘솔 Server Actions.
 * proxy.ts가 /admin 라우팅을 지키지만, Server Action은 URL과 무관하게 POST로 직접
 * 호출될 수 있으므로 모든 액션에서 is_operator를 재확인한다 (D-1).
 * 감사 로그(admin_audit_log)는 operator INSERT 정책이 없으므로 service-role로 기록한다.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SafetyLevel } from "@/lib/labels";
import type { Json } from "@/lib/database.types";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type UsageContext = Record<"work" | "friends" | "family" | "sns", SafetyLevel>;

/** 운영자 인증 확인 — 통과 시 operator 세션 클라이언트와 uid 반환 */
async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "operator") throw new Error("운영자 권한이 없어요.");
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
  await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.";
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
}): Promise<ActionResult<{ memeId: string }>> {
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

    // 1) 밈 생성 (운영자 RLS로 직접 INSERT 가능 — moderation_status 기본값 pending)
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
      submitted_by: submission.submitter_id,
    };
    let memeId: string | null = null;
    let insertError: string | null = null;
    for (const slug of [slugify(input.title), `${slugify(input.title)}-${Date.now().toString(36)}`]) {
      const { data, error } = await supabase
        .from("memes")
        .insert({ ...baseRow, slug })
        .select("id")
        .single();
      if (!error && data) {
        memeId = data.id;
        insertError = null;
        break;
      }
      insertError = error?.message ?? "밈 생성에 실패했어요.";
      if (error?.code !== "23505") break; // slug 중복이 아니면 재시도 의미 없음
    }
    if (!memeId) return { ok: false, error: insertError ?? "밈 생성에 실패했어요." };

    // 2) 검수 상태 전이 — 트리거가 역행을 차단하므로 순서대로 전진
    for (const status of ["fact_checking", "rights_checking", "approved"] as const) {
      const { error } = await supabase
        .from("memes")
        .update({ moderation_status: status, updated_at: new Date().toISOString() })
        .eq("id", memeId);
      if (error) {
        return {
          ok: false,
          error: `밈은 생성됐지만 상태 전이(${status})에 실패했어요: ${error.message} — 밈 관리에서 이어서 처리해 주세요.`,
        };
      }
    }

    // 3) 출처 기록
    if (submission.source_url) {
      let platform = "web";
      try {
        platform = new URL(submission.source_url).hostname.replace(/^www\./, "");
      } catch {
        /* URL 파싱 실패 시 web 유지 */
      }
      await supabase.from("meme_sources").insert({
        meme_id: memeId,
        platform,
        source_url: submission.source_url,
      });
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

    // 5) 제보 상태 갱신
    await supabase
      .from("meme_submissions")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", input.submissionId);

    await logAudit(uid, "submission.approve", "meme_submission", input.submissionId, {
      meme_id: memeId,
      title: input.title.trim(),
    });
    revalidatePath("/admin/submissions");
    revalidatePath("/admin/memes");
    revalidatePath("/");
    return { ok: true, data: { memeId } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── 밈 관리 ─────────────────────────────────────────── */

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
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!input.title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    const { error } = await supabase
      .from("memes")
      .update({
        title: input.title.trim(),
        summary: input.summary.trim(),
        description: input.description.trim(),
        origin: input.origin.trim(),
        usage_note: input.usageNote.trim() || null,
        caution: input.caution.trim() || null,
        aliases: input.aliases.map((a) => a.trim()).filter(Boolean),
        safety_level: input.safetyLevel,
        lifecycle_status: input.lifecycleStatus,
        category: input.category,
        difficulty: input.difficulty,
        sentiment: input.sentiment,
        origin_year: input.originYear,
        usage_context: input.usageContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.memeId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "meme.update", "meme", input.memeId);
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function transitionMemeStatus(input: {
  memeId: string;
  to: "pending" | "fact_checking" | "rights_checking" | "approved" | "limited" | "rejected";
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("memes")
      .update({ moderation_status: input.to, updated_at: new Date().toISOString() })
      .eq("id", input.memeId);
    if (error) {
      // 트리거의 invalid moderation transition 에러를 사용자 친화적으로
      const msg = error.message.includes("invalid moderation transition")
        ? "허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요."
        : error.message;
      return { ok: false, error: msg };
    }
    await logAudit(uid, "meme.transition", "meme", input.memeId, { to: input.to });
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidatePath("/");
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
    const { error } = await admin
      .from("discussions")
      .update({ status: input.status })
      .eq("id", input.discussionId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "discussion.set_status", "discussion", input.discussionId, {
      status: input.status,
    });
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── AI 초안 (Anthropic Messages API — fetch 직접 호출) ── */

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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY 설정 필요" };

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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        system:
          "당신은 한국 밈 사전 서비스 '밈캐치'의 운영 보조입니다. 제보된 밈 정보를 바탕으로 사전 항목 초안을 작성합니다. " +
          "모든 문장은 해요체로 씁니다. 확실하지 않은 사실은 단정하지 말고 '~로 알려져 있어요'처럼 표현합니다. " +
          "safety_level 기준: green=써도 됨, yellow=맥락 주의, gray=이미 유행이 지남, red=쓰면 위험(차별·혐오·논란). " +
          "usage_context는 직장(work)·친구(friends)·가족(family)·공개 SNS(sns) 각각에서의 사용 안전도를 같은 기준으로 판단합니다.",
        messages: [{ role: "user", content: userPrompt }],
        output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `AI 호출에 실패했어요 (${res.status}). ${body.slice(0, 200)}` };
    }
    const message: {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    } = await res.json();

    if (message.stop_reason === "refusal") {
      return { ok: false, error: "AI가 이 요청의 초안 생성을 거절했어요. 직접 작성해 주세요." };
    }
    const textBlock = message.content?.find((b) => b.type === "text" && b.text);
    if (!textBlock?.text) return { ok: false, error: "AI 응답이 비어 있어요. 다시 시도해 주세요." };

    let draft: DraftResult;
    try {
      draft = JSON.parse(textBlock.text) as DraftResult;
    } catch {
      return { ok: false, error: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." };
    }

    await logAudit(uid, "ai.generate_draft", "meme_submission", submissionId, {
      model: "claude-sonnet-5",
    });
    return { ok: true, data: draft };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
