"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { RIGHTS_BASIS, SOURCE_ROLES, type RightsBasis, type SourceRole } from "@/lib/sources/review";

export type MpeActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();
const reviewSchema = z.object({
  candidateId: idSchema,
  stage: z.enum(["FACT_CHECKING", "RIGHTS_CHECKING", "PUBLISH"]),
  decision: z.enum(["APPROVED", "PUBLISHED", "LIMITED", "REJECTED", "CHANGES_REQUESTED"]),
  reason: z.string().trim().max(2_000).optional(),
});
const draftSchema = z.object({ candidateId: idSchema, draft: z.record(z.string(), z.unknown()) });
const sourceRightsSchema = z.object({
  ingestionId: idSchema,
  sourceRole: z.enum(SOURCE_ROLES),
  rightsBasis: z.enum(RIGHTS_BASIS),
});

async function requireOperator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "operator") throw new Error("운영자 권한이 없어요.");
  return { supabase, uid: user.id };
}

async function audit(actorId: string, action: string, entityId: string, detail?: Json) {
  await createAdminClient().from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "mpe_candidate",
    entity_id: entityId,
    detail: detail ?? null,
  });
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "알 수 없는 오류가 발생했어요.";
  const known: Record<string, string> = {
    review_stage_out_of_order: "현재 단계와 요청 단계가 달라요. 새로고침해 주세요.",
    approved_evidence_required: "승인된 근거가 없는 주장은 다음 단계로 진행할 수 없어요.",
    source_and_rights_required: "출처와 권리 근거를 확인한 뒤 진행해 주세요.",
    candidate_not_found: "검수 후보를 찾을 수 없어요.",
    claim_not_found: "검수할 근거를 찾을 수 없어요.",
    claim_review_stage_closed: "사실 검수 단계에서만 주장 근거를 변경할 수 있어요.",
    job_not_found: "처리 작업을 찾을 수 없어요.",
    job_not_terminal: "완료·실패·건너뜀 작업만 재처리할 수 있어요.",
    operator_required: "운영자 권한이 없어요.",
  };
  return known[error.message] ?? error.message;
}

export async function reviewMpeCandidate(input: {
  candidateId: string;
  stage: "FACT_CHECKING" | "RIGHTS_CHECKING" | "PUBLISH";
  decision: "APPROVED" | "PUBLISHED" | "LIMITED" | "REJECTED" | "CHANGES_REQUESTED";
  reason?: string;
}): Promise<MpeActionResult> {
  try {
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "검수 요청 형식이 올바르지 않아요." };
    if (parsed.data.stage === "PUBLISH" && parsed.data.decision === "APPROVED") {
      return { ok: false, error: "공개 단계에서는 공개 또는 제한 공개를 선택해 주세요." };
    }
    if (parsed.data.stage !== "PUBLISH" && ["PUBLISHED", "LIMITED"].includes(parsed.data.decision)) {
      return { ok: false, error: "앞 단계를 건너뛰어 공개할 수 없어요." };
    }

    const { supabase, uid } = await requireOperator();
    const { error } = await supabase.rpc("review_mpe_candidate", {
      p_candidate_id: parsed.data.candidateId,
      p_stage: parsed.data.stage,
      p_decision: parsed.data.decision,
      p_reason: parsed.data.reason || undefined,
    });
    if (error) throw new Error(error.message);
    await audit(uid, "mpe.review", parsed.data.candidateId, {
      stage: parsed.data.stage,
      decision: parsed.data.decision,
    });
    revalidatePath("/admin/mpe");
    revalidatePath(`/admin/mpe/${parsed.data.candidateId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveMpeCandidateRevision(input: {
  candidateId: string;
  draft: Record<string, unknown>;
}): Promise<MpeActionResult> {
  try {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "초안 형식이 올바르지 않아요." };
    const serialized = JSON.stringify(parsed.data.draft);
    if (serialized.length > 100_000) return { ok: false, error: "초안이 너무 커요." };

    const { supabase, uid } = await requireOperator();
    const { error } = await supabase.rpc("save_mpe_candidate_revision", {
      p_candidate_id: parsed.data.candidateId,
      p_draft_json: parsed.data.draft as Json,
    });
    if (error) throw new Error(error.message);
    await audit(uid, "mpe.revision.save", parsed.data.candidateId);
    revalidatePath(`/admin/mpe/${parsed.data.candidateId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function setMpeIngestionSourceRights(input: {
  ingestionId: string;
  sourceRole: SourceRole;
  rightsBasis: RightsBasis;
}): Promise<MpeActionResult> {
  try {
    const parsed = sourceRightsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "출처 역할과 권리 근거를 확인해 주세요." };
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase.rpc("set_mpe_ingestion_source_rights", {
      p_ingestion_id: parsed.data.ingestionId,
      p_source_role: parsed.data.sourceRole,
      p_rights_basis: parsed.data.rightsBasis,
    });
    if (error) throw new Error(error.message);
    await audit(uid, "mpe.source_rights.set", parsed.data.ingestionId, {
      source_role: parsed.data.sourceRole,
      rights_basis: parsed.data.rightsBasis,
    });
    revalidatePath("/admin/mpe");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function reviewMpeClaim(input: {
  candidateId: string;
  claimId: string;
  decision: "APPROVED" | "REJECTED";
}): Promise<MpeActionResult> {
  try {
    const parsed = z.object({ candidateId: idSchema, claimId: idSchema, decision: z.enum(["APPROVED", "REJECTED"]) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "근거 검수 요청 형식이 올바르지 않아요." };
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase.rpc("review_mpe_claim", {
      p_candidate_id: parsed.data.candidateId,
      p_claim_id: parsed.data.claimId,
      p_decision: parsed.data.decision,
    });
    if (error) throw new Error(error.message);
    await audit(uid, "mpe.claim.review", parsed.data.claimId, {
      candidate_id: parsed.data.candidateId,
      decision: parsed.data.decision,
    });
    revalidatePath(`/admin/mpe/${parsed.data.candidateId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function reprocessMpeJob(input: { jobId: string }): Promise<MpeActionResult> {
  try {
    if (!idSchema.safeParse(input.jobId).success) return { ok: false, error: "작업 ID가 올바르지 않아요." };
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase.rpc("reprocess_mpe_job", { p_job_id: input.jobId });
    if (error) throw new Error(error.message);
    await audit(uid, "mpe.job.reprocess", input.jobId);
    revalidatePath("/admin/mpe");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
