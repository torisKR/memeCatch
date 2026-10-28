"use server";

/**
 * 출처 검수 큐 Server Action.
 *
 * 실제 상태 전이·공개 projection·감사 기록은 review_meme_source_atomic
 * 한 트랜잭션에서 수행한다. 운영 마이그레이션 적용과 별개로 웹 경로는
 * SOURCE_REVIEW_ATOMIC_ENABLED=true인 배포에서만 열린다.
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { PUBLIC_COUNT_CACHE_TAG } from "@/lib/supabase/public-count-cache";
import { createClient } from "@/lib/supabase/server";
import {
  RIGHTS_BASIS,
  SOURCE_ROLES,
  type RightsBasis,
  type SourceRole,
} from "@/lib/sources/review";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type DbError = { message: string };
type AtomicSourceReviewRpc = (
  name: "review_meme_source_atomic",
  args: {
    p_meme_id: string;
    p_source_id: string;
    p_decision: "approve" | "reject";
    p_source_role: SourceRole | null;
    p_rights_basis: RightsBasis | null;
    p_note: string | null;
  },
) => Promise<{ data: unknown; error: DbError | null }>;
type AtomicSourceReviewClient = { rpc: AtomicSourceReviewRpc };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATOMIC_REVIEW_UNAVAILABLE =
  "원자적 출처 검수 기능이 아직 활성화되지 않았어요. 후보는 대기 상태로 유지됩니다.";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const { data: isOperator, error } = await supabase.rpc("is_operator");
  if (error || !isOperator) throw new Error("운영자 권한이 없어요.");
  return supabase;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.";
}

export async function reviewMemeSource(input: {
  memeId: string;
  sourceId: string;
  decision: "approve" | "reject";
  sourceRole?: SourceRole;
  rightsBasis?: RightsBasis;
  note?: string;
}): Promise<ActionResult> {
  try {
    if (process.env.SOURCE_REVIEW_ATOMIC_ENABLED !== "true") {
      return { ok: false, error: ATOMIC_REVIEW_UNAVAILABLE };
    }
    if (!UUID_PATTERN.test(input.memeId) || !UUID_PATTERN.test(input.sourceId)) {
      return { ok: false, error: "검수 대상을 찾을 수 없어요." };
    }

    const note = input.note?.trim() || null;
    if (note && note.length > 1000) {
      return { ok: false, error: "검수 메모는 1,000자 이내로 입력해 주세요." };
    }
    if (input.decision === "reject" && !note) {
      return { ok: false, error: "반려 사유를 입력해 주세요." };
    }

    // ── 승인 입력 정책 ─────────────────────────────────────
    if (input.decision === "approve") {
      if (!input.sourceRole || !SOURCE_ROLES.includes(input.sourceRole)) {
        return { ok: false, error: "출처 역할을 선택해 주세요." };
      }
      if (!input.rightsBasis || !RIGHTS_BASIS.includes(input.rightsBasis)) {
        return { ok: false, error: "권리 근거를 선택해 주세요." };
      }
      if (input.rightsBasis === "unknown" || input.rightsBasis === "blocked") {
        return {
          ok: false,
          error: "권리가 확인되지 않은 출처는 승인할 수 없어요. 링크만 허용하거나 반려해 주세요.",
        };
      }
      if (input.sourceRole === "original" && input.rightsBasis === "link_only") {
        return {
          ok: false,
          error: "링크만 허용된 출처를 원본으로 표시할 수 없어요. 최초 확인 출처로 승인해 주세요.",
        };
      }
    }

    const supabase = await requireOperator();
    const atomicClient = supabase as unknown as AtomicSourceReviewClient;
    const { error } = await atomicClient.rpc("review_meme_source_atomic", {
      p_meme_id: input.memeId,
      p_source_id: input.sourceId,
      p_decision: input.decision,
      p_source_role: input.decision === "approve" ? (input.sourceRole ?? null) : null,
      p_rights_basis: input.decision === "approve" ? (input.rightsBasis ?? null) : null,
      p_note: note,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/sources");
    if (input.decision === "approve") {
      revalidatePath("/global");
      revalidateTag(PUBLIC_COUNT_CACHE_TAG, { expire: 0 });
      revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
