"use server";

/**
 * 출처 검수 큐 Server Actions.
 *
 * 승인 = meme_media 원장 갱신 + 기존 공개 테이블(meme_sources/meme_contents)로 복사.
 * 원본 파일은 절대 저장하지 않고 플랫폼 공식 임베드 또는 링크만 게시한다.
 * 모든 액션에서 is_operator를 재확인한다 (D-1 — lib/actions/admin.ts와 동일 규약).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import {
  DISPLAY_PLATFORM_LABELS,
  RIGHTS_BASIS,
  SOURCE_ROLES,
  type RightsBasis,
  type SourceRole,
} from "@/lib/sources/review";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) throw new Error("운영자 권한이 없어요.");
  return { supabase, uid: user.id };
}

async function logAudit(
  actorId: string,
  action: string,
  entityId: string,
  detail?: Record<string, unknown>,
) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "meme_media",
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.";
}

type PendingRow = {
  meme_id: string;
  source_id: string;
  review_state: string;
  media_sources: {
    id: string;
    platform: string;
    external_id: string | null;
    canonical_url: string;
    title: string | null;
    channel_name: string | null;
    embeddable: boolean | null;
    thumbnail_url: string | null;
    removed_at: string | null;
  } | null;
};

export async function reviewMemeSource(input: {
  memeId: string;
  sourceId: string;
  decision: "approve" | "reject";
  sourceRole?: SourceRole;
  rightsBasis?: RightsBasis;
  note?: string;
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const note = input.note?.trim() || null;

    const { data: row, error: rowError } = await supabase
      .from("meme_media")
      .select(
        "meme_id, source_id, review_state, media_sources(id, platform, external_id, canonical_url, title, channel_name, embeddable, thumbnail_url, removed_at)",
      )
      .eq("meme_id", input.memeId)
      .eq("source_id", input.sourceId)
      .single<PendingRow>();
    if (rowError || !row) return { ok: false, error: "검수 대상을 찾을 수 없어요." };
    if (row.review_state !== "pending") {
      return { ok: false, error: "이미 처리된 후보예요." };
    }
    const source = row.media_sources;
    if (!source) return { ok: false, error: "출처 정보를 찾을 수 없어요." };

    const now = new Date().toISOString();

    if (input.decision === "reject") {
      if (!note) return { ok: false, error: "반려 사유를 입력해 주세요." };
      const { error } = await supabase
        .from("meme_media")
        .update({ review_state: "rejected", reviewer_note: note, reviewed_at: now })
        .eq("meme_id", input.memeId)
        .eq("source_id", input.sourceId);
      if (error) return { ok: false, error: error.message };
      await logAudit(uid, "source.reject", `${input.memeId}:${input.sourceId}`, { note });
      revalidatePath("/admin/sources");
      return { ok: true };
    }

    // ── 승인 ─────────────────────────────────────────────
    const sourceRole = input.sourceRole;
    const rightsBasis = input.rightsBasis;
    if (!sourceRole || !SOURCE_ROLES.includes(sourceRole)) {
      return { ok: false, error: "출처 역할을 선택해 주세요." };
    }
    if (!rightsBasis || !RIGHTS_BASIS.includes(rightsBasis)) {
      return { ok: false, error: "권리 근거를 선택해 주세요." };
    }
    if (rightsBasis === "blocked" || rightsBasis === "unknown") {
      return {
        ok: false,
        error: "권리가 확인되지 않은 출처는 승인할 수 없어요. 링크만 허용하거나 반려해 주세요.",
      };
    }
    if (sourceRole === "original" && rightsBasis === "link_only") {
      return {
        ok: false,
        error: "링크만 허용된 출처를 원본으로 표시할 수 없어요. 최초 확인 출처로 승인해 주세요.",
      };
    }
    if (source.removed_at) {
      return { ok: false, error: "삭제된 출처예요. 대체 출처를 등록해 주세요." };
    }

    const linkOnly = rightsBasis === "link_only";
    if (!linkOnly && source.embeddable === false) {
      return {
        ok: false,
        error: "임베드가 불가한 출처예요. 링크만 허용으로 승인해 주세요.",
      };
    }

    // 1) 원장 갱신
    const { error: ledgerError } = await supabase
      .from("meme_media")
      .update({
        review_state: "approved",
        source_role: sourceRole,
        rights_basis: rightsBasis,
        reviewer_note: note,
        reviewed_at: now,
      })
      .eq("meme_id", input.memeId)
      .eq("source_id", input.sourceId);
    if (ledgerError) return { ok: false, error: ledgerError.message };

    const displayPlatform = DISPLAY_PLATFORM_LABELS[source.platform] ?? "web";

    // 2) 출처 링크 게시 (중복 방지)
    const { data: existingSource } = await supabase
      .from("meme_sources")
      .select("id")
      .eq("meme_id", input.memeId)
      .eq("source_url", source.canonical_url)
      .maybeSingle();
    if (!existingSource) {
      const { error } = await supabase.from("meme_sources").insert({
        meme_id: input.memeId,
        platform: displayPlatform,
        source_url: source.canonical_url,
        title: source.title,
        creator_name: source.channel_name,
        copyright_status: linkOnly ? "unknown" : "embeddable",
      });
      if (error) return { ok: false, error: `출처 링크 게시 실패: ${error.message}` };
    }

    // 3) 공식 임베드 게시 — 링크만 허용이면 건너뛴다
    if (!linkOnly && source.external_id) {
      const { data: existingContent } = await supabase
        .from("meme_contents")
        .select("id")
        .eq("meme_id", input.memeId)
        .eq("type", "embed")
        .eq("platform", displayPlatform)
        .eq("content_id", source.external_id)
        .maybeSingle();
      if (existingContent) {
        await supabase
          .from("meme_contents")
          .update({ availability: "live", moderation_status: "approved" })
          .eq("id", existingContent.id);
      } else {
        const { error } = await supabase.from("meme_contents").insert({
          meme_id: input.memeId,
          type: "embed",
          platform: displayPlatform,
          content_id: source.external_id,
          url: source.canonical_url,
          thumbnail_url: source.thumbnail_url,
          caption: source.title,
          is_representative: false,
          availability: "live",
          moderation_status: "approved",
        });
        if (error) return { ok: false, error: `임베드 게시 실패: ${error.message}` };
      }
    }

    await logAudit(uid, "source.approve", `${input.memeId}:${input.sourceId}`, {
      source_role: sourceRole,
      rights_basis: rightsBasis,
      link_only: linkOnly,
    });
    revalidatePath("/admin/sources");
    revalidatePath("/global");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
