"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validatePublicProductUrl } from "@/lib/creator-products";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { canonicalizeEvidenceUrl } from "@/lib/trend/external-evidence";

export type TrendCandidateActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const decisionSchema = z.enum([
  "approve",
  "changes_requested",
  "hold",
  "reject",
  "merge",
  "split",
  "link_existing",
  "link_alias",
]);

const reviewSchema = z.object({
  candidateId: z.uuid("올바른 후보 ID가 아니에요."),
  decision: decisionSchema,
  note: z.string().trim().min(1, "검수 메모를 입력해 주세요.").max(2000),
  publicSummary: z.string().trim().max(2000),
  evidenceScope: z.string().trim().max(500),
  evidenceLinks: z.string().max(5000),
  targetMemeId: z.union([z.literal(""), z.uuid("연결할 기존 밈 ID를 확인해 주세요.")]),
  targetCandidateId: z.union([z.literal(""), z.uuid("대상 후보 ID를 확인해 주세요.")]),
  splitSignalIds: z.string().max(5000),
});

class ActionError extends Error {}

function parseEvidenceLinks(value: string): Array<{ label: string; url: string }> {
  const links = value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (links.length > 10) throw new ActionError("근거 링크는 10개까지 입력할 수 있어요.");
  return links.map((line, index) => {
    const [rawLabel, rawUrl] = line.includes("|")
      ? line.split("|", 2)
      : [`근거 ${index + 1}`, line];
    const label = rawLabel.trim();
    try {
      const sourceUrl = rawUrl.trim();
      if (!validatePublicProductUrl(sourceUrl)) throw new Error();
      const canonicalUrl = canonicalizeEvidenceUrl(sourceUrl);
      if (!canonicalUrl) throw new Error();
      return { label: label || `근거 ${index + 1}`, url: canonicalUrl };
    } catch {
      throw new ActionError(`근거 링크 ${index + 1}의 URL을 확인해 주세요.`);
    }
  });
}

function parseSplitSignalIds(value: string): string[] {
  const values = value.split(/[\s,]+/u).map((item) => item.trim()).filter(Boolean);
  const parsed = z.array(z.uuid("분리할 사용례 ID를 확인해 주세요.")).max(100).safeParse(values);
  if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "분리할 사용례 ID를 확인해 주세요.");
  return [...new Set(parsed.data)];
}

function rpcErrorMessage(message: string): string {
  if (message.includes("trend_candidate_evidence_gate_failed")) {
    return "검수된 독립 사용례 3건, 서로 다른 작성자 3명, 비교 성장, 공개 정책, 기존 밈 연결을 먼저 확인해 주세요.";
  }
  if (message.includes("evidence_links_not_verified")) {
    return "공개 근거 링크는 검수된 독립 사용례의 canonical URL을 3개 이상 그대로 선택해 주세요.";
  }
  if (message.includes("target_meme_required")) return "연결할 기존 밈 UUID를 입력해 주세요.";
  if (message.includes("target_meme_not_public")) return "승인 또는 제한 공개 상태인 기존 밈만 연결할 수 있어요.";
  if (message.includes("target_candidate_required")) return "현재 후보와 다른 대상 후보 UUID를 입력해 주세요.";
  if (message.includes("target_candidate_not_found")) return "대상 후보를 찾지 못했어요.";
  if (message.includes("split_signal_ids_required")) return "분리할 사용례를 하나 이상 선택해 주세요.";
  if (message.includes("split_signal_not_linked")) return "현재 후보에 연결된 사용례만 분리할 수 있어요.";
  return "트렌드 후보 검수 결과를 저장하지 못했어요.";
}

export async function reviewTrendCandidate(input: {
  candidateId: string;
  decision: string;
  note: string;
  publicSummary: string;
  evidenceScope: string;
  evidenceLinks: string;
  targetMemeId?: string;
  targetCandidateId?: string;
  splitSignalIds?: string;
}): Promise<TrendCandidateActionResult> {
  const parsed = reviewSchema.safeParse({
    ...input,
    targetMemeId: input.targetMemeId ?? "",
    targetCandidateId: input.targetCandidateId ?? "",
    splitSignalIds: input.splitSignalIds ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  try {
    const {
      candidateId, decision, note, publicSummary, evidenceScope,
      targetMemeId, targetCandidateId,
    } = parsed.data;
    if (decision === "approve" && (!publicSummary || !evidenceScope)) {
      throw new ActionError("승인할 때는 공개 설명과 조사 범위를 입력해 주세요.");
    }
    const evidenceLinks = parseEvidenceLinks(parsed.data.evidenceLinks);
    const splitSignalIds = parseSplitSignalIds(parsed.data.splitSignalIds);
    if ((decision === "link_existing" || decision === "link_alias") && !targetMemeId) {
      throw new ActionError("연결할 기존 밈 UUID를 입력해 주세요.");
    }
    if ((decision === "merge" || decision === "split") && (!targetCandidateId || targetCandidateId === candidateId)) {
      throw new ActionError("현재 후보와 다른 대상 후보 UUID를 입력해 주세요.");
    }
    if (decision === "split" && splitSignalIds.length === 0) {
      throw new ActionError("분리할 사용례를 하나 이상 선택해 주세요.");
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ActionError("로그인이 필요해요.");
    const { data: isOperator } = await supabase.rpc("is_operator");
    if (!isOperator) throw new ActionError("운영자 권한이 없어요.");

    const { error } = await supabase.rpc("review_trend_candidate", {
      p_candidate_id: candidateId,
      p_decision: decision,
      p_note: note,
      p_public_summary: publicSummary || null,
      p_evidence_scope: evidenceScope || null,
      p_evidence_links: evidenceLinks,
      p_target_meme_id: targetMemeId || null,
      p_target_candidate_id: targetCandidateId || null,
      p_split_signal_ids: splitSignalIds,
    });
    if (error) {
      throw new ActionError(rpcErrorMessage(error.message));
    }

    revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
    revalidatePath("/");
    revalidatePath("/admin/trend-candidates");
    return {
      ok: true,
      message: decision === "approve" ? "검수된 확산 근거를 공개했어요." : "검수 결과를 저장했어요.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ActionError ? error.message : "트렌드 후보 검수에 실패했어요.",
    };
  }
}

export async function reviewTrendCandidateSignal(input: {
  candidateId: string;
  signalId: string;
  relationship: string;
}): Promise<TrendCandidateActionResult> {
  const parsed = z.object({
    candidateId: z.uuid(),
    signalId: z.uuid(),
    relationship: z.enum(["independent", "repost", "crosspost", "citation", "unknown"]),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "사용례 분류 입력을 확인해 주세요." };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ActionError("로그인이 필요해요.");
    const { data: isOperator } = await supabase.rpc("is_operator");
    if (!isOperator) throw new ActionError("운영자 권한이 없어요.");
    const { data: count, error } = await supabase.rpc("review_trend_candidate_signal", {
      p_candidate_id: parsed.data.candidateId,
      p_signal_id: parsed.data.signalId,
      p_relationship: parsed.data.relationship,
    });
    if (error) throw new ActionError("사용례 관계를 저장하지 못했어요.");
    revalidatePath("/admin/trend-candidates");
    return { ok: true, message: `분류를 저장했어요. 독립 작성자 ${count ?? 0}명` };
  } catch (error) {
    return { ok: false, error: error instanceof ActionError ? error.message : "사용례 분류에 실패했어요." };
  }
}
