"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { createClient } from "@/lib/supabase/server";

export type BrandWorkspaceActionState = { ok: boolean; message: string };
export type BrandApproval = { decision: "approved" | "rejected"; note: string | null; created_at: string };
export type BrandEvaluation = {
  id: string;
  meme_name: string;
  meme_path: string | null;
  proposed_copy: string;
  fit_score: number;
  risk_level: "low" | "medium" | "high";
  rationale: string;
  matched_forbidden_expressions: string[];
  created_at: string;
  approval: BrandApproval | null;
};
export type BrandWorkspaceBundle = {
  workspace: {
    id: string;
    brand_name: string;
    brand_context: string;
    brand_tone: string;
    forbidden_expressions: string[];
  };
  evaluations: BrandEvaluation[];
};

const workspaceSchema = z.object({
  brandName: z.string().trim().min(1, "브랜드명을 입력해 주세요.").max(80),
  brandContext: z.string().trim().min(1, "브랜드 문맥을 입력해 주세요.").max(2000),
  brandTone: z.string().trim().min(1, "브랜드 톤을 입력해 주세요.").max(500),
  forbiddenExpressions: z.string().max(5000),
});
const evaluationSchema = z.object({
  memeName: z.string().trim().min(1, "밈 이름을 입력해 주세요.").max(120),
  memePath: z.string().trim().regex(/^\/memes\/[^/?#\s]{1,200}$/, "밈캐치 상세 경로를 입력해 주세요."),
  proposedCopy: z.string().trim().min(1, "사용 문구를 입력해 주세요.").max(2000),
  fitScore: z.coerce.number().int().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high"]),
  rationale: z.string().trim().min(1, "판단 근거를 입력해 주세요.").max(2000),
});
const approvalSchema = z.object({
  evaluationId: z.uuid("올바른 평가 ID가 아니에요."),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000),
});

type RpcClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

async function premiumRpcClient(): Promise<RpcClient> {
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) throw new Error("로그인이 필요해요.");
  if (!entitlement.isPremium) throw new Error("Plus 멤버십이 필요해요.");
  return (await createClient()) as unknown as RpcClient;
}

function failure(error: unknown): BrandWorkspaceActionState {
  const message = error instanceof Error ? error.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
  if (message.includes("decision_already_recorded")) return { ok: false, message: "이미 승인 또는 반려된 평가예요." };
  return { ok: false, message };
}

function invalid(parsed: { success: false; error: z.ZodError }): BrandWorkspaceActionState {
  return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
}

export async function saveBrandWorkspace(
  _previous: BrandWorkspaceActionState,
  formData: FormData,
): Promise<BrandWorkspaceActionState> {
  const parsed = workspaceSchema.safeParse({
    brandName: formData.get("brandName"),
    brandContext: formData.get("brandContext"),
    brandTone: formData.get("brandTone"),
    forbiddenExpressions: formData.get("forbiddenExpressions"),
  });
  if (!parsed.success) return invalid(parsed);
  const expressions = [...new Set(parsed.data.forbiddenExpressions.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
  if (expressions.length > 50 || expressions.some((item) => item.length > 100)) {
    return { ok: false, message: "금지 표현은 100자 이내로 최대 50개까지 저장할 수 있어요." };
  }
  try {
    const client = await premiumRpcClient();
    const { error } = await client.rpc("save_brand_workspace", {
      p_brand_name: parsed.data.brandName,
      p_brand_context: parsed.data.brandContext,
      p_brand_tone: parsed.data.brandTone,
      p_forbidden_expressions: expressions,
    });
    if (error) throw new Error("브랜드 문맥을 저장하지 못했어요.");
    revalidatePath("/premium/brand-workspace");
    return { ok: true, message: "브랜드 문맥을 저장했어요." };
  } catch (error) { return failure(error); }
}

export async function saveBrandFitEvaluation(
  _previous: BrandWorkspaceActionState,
  formData: FormData,
): Promise<BrandWorkspaceActionState> {
  const parsed = evaluationSchema.safeParse({
    memeName: formData.get("memeName"), memePath: formData.get("memePath"), proposedCopy: formData.get("proposedCopy"),
    fitScore: formData.get("fitScore"), riskLevel: formData.get("riskLevel"), rationale: formData.get("rationale"),
  });
  if (!parsed.success) return invalid(parsed);
  try {
    const client = await premiumRpcClient();
    const { error } = await client.rpc("save_brand_fit_evaluation", {
      p_meme_name: parsed.data.memeName, p_meme_path: parsed.data.memePath, p_proposed_copy: parsed.data.proposedCopy,
      p_fit_score: parsed.data.fitScore, p_risk_level: parsed.data.riskLevel, p_rationale: parsed.data.rationale,
    });
    if (error) throw new Error("적합도 평가를 저장하지 못했어요. 브랜드 문맥을 먼저 저장해 주세요.");
    revalidatePath("/premium/brand-workspace");
    return { ok: true, message: "적합도 평가를 저장했어요." };
  } catch (error) { return failure(error); }
}

export async function recordBrandApproval(
  _previous: BrandWorkspaceActionState,
  formData: FormData,
): Promise<BrandWorkspaceActionState> {
  const parsed = approvalSchema.safeParse({
    evaluationId: formData.get("evaluationId"), decision: formData.get("decision"), note: formData.get("note") ?? "",
  });
  if (!parsed.success) return invalid(parsed);
  try {
    const client = await premiumRpcClient();
    const { error } = await client.rpc("record_brand_approval", {
      p_evaluation_id: parsed.data.evaluationId, p_decision: parsed.data.decision, p_note: parsed.data.note || null,
    });
    if (error) {
      throw new Error(
        error.message?.includes("decision_already_recorded")
          ? "decision_already_recorded"
          : "승인 기록을 저장하지 못했어요.",
      );
    }
    revalidatePath("/premium/brand-workspace");
    return { ok: true, message: parsed.data.decision === "approved" ? "승인 기록을 남겼어요." : "반려 기록을 남겼어요." };
  } catch (error) { return failure(error); }
}

export async function loadBrandWorkspace(): Promise<BrandWorkspaceBundle | null> {
  const client = await premiumRpcClient();
  const { data, error } = await client.rpc("get_brand_workspace_bundle");
  if (error) throw new Error("브랜드 워크스페이스를 불러오지 못했어요.");
  return data as BrandWorkspaceBundle | null;
}
