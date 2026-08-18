"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ENGLISH_PILOT_STATUSES } from "@/lib/growth/pilot";

type GrowthRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

const slotSchema = z
  .object({
    slot: z.coerce.number().int().min(1).max(20),
    memeId: z.union([z.literal(""), z.uuid()]),
    status: z.enum(ENGLISH_PILOT_STATUSES),
    operatorNote: z.string().trim().max(1000),
  })
  .refine((value) => value.status === "open" || value.memeId !== "", {
    message: "배정할 영문 랜딩을 선택해 주세요.",
  });

const interviewSchema = z.object({
  participantReference: z.string().trim().min(2).max(100),
  interviewedAt: z.string().min(1),
  market: z.string().trim().min(2).max(100),
  segment: z.string().trim().min(2).max(100),
  summary: z.string().trim().min(20).max(4000),
  evidenceUrl: z.union([z.literal(""), z.url().refine((value) => value.startsWith("https://"))]),
});

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
  return supabase;
}

function growthRpc(client: Awaited<ReturnType<typeof createClient>>): GrowthRpc {
  return client.rpc as unknown as GrowthRpc;
}

function growthRedirect(kind: "saved" | "error", message: string): never {
  redirect(`/admin/growth?${kind}=${encodeURIComponent(message)}`);
}

export async function saveEnglishPilotSlot(formData: FormData): Promise<void> {
  const parsed = slotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    growthRedirect("error", parsed.error.issues[0]?.message ?? "슬롯 입력을 확인해 주세요.");
  }

  try {
    const supabase = await requireOperator();
    const { error } = await growthRpc(supabase)("set_growth_english_pilot_slot", {
      p_slot: parsed.data.slot,
      p_meme_id: parsed.data.memeId || null,
      p_status: parsed.data.status,
      p_operator_note: parsed.data.operatorNote,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    growthRedirect(
      "error",
      error instanceof Error && error.message === "current_reviewed_english_translation_required"
        ? "최신 원문 기준으로 검수 완료된 영문 번역만 배정할 수 있어요."
        : "영문 파일럿 슬롯을 저장하지 못했어요.",
    );
  }

  revalidatePath("/admin/growth");
  growthRedirect("saved", `${parsed.data.slot}번 슬롯을 저장했어요.`);
}

export async function recordGrowthPilotInterview(formData: FormData): Promise<void> {
  const parsed = interviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    growthRedirect("error", parsed.error.issues[0]?.message ?? "인터뷰 입력을 확인해 주세요.");
  }
  const interviewedAt = new Date(parsed.data.interviewedAt);
  if (!Number.isFinite(interviewedAt.getTime()) || interviewedAt.getTime() > Date.now() + 300_000) {
    growthRedirect("error", "실제로 진행한 인터뷰 시각을 확인해 주세요.");
  }

  try {
    const supabase = await requireOperator();
    const { error } = await growthRpc(supabase)("record_growth_pilot_interview", {
      p_participant_reference: parsed.data.participantReference,
      p_interviewed_at: interviewedAt.toISOString(),
      p_market: parsed.data.market,
      p_segment: parsed.data.segment,
      p_summary: parsed.data.summary,
      p_evidence_url: parsed.data.evidenceUrl || null,
    });
    if (error) throw new Error(error.message);
  } catch {
    growthRedirect("error", "인터뷰 기록을 저장하지 못했어요.");
  }

  revalidatePath("/admin/growth");
  growthRedirect("saved", "실제 인터뷰 기록을 저장했어요.");
}
