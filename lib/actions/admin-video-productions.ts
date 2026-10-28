"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { parseVideoScript, normalizedContentFingerprint, productionReadiness } from "@/lib/video-production/core.mjs";
import type { RightsAsset } from "@/lib/video-production/core.mjs";
import { generateVideoDraft } from "@/lib/video-production/draft.server";
import type { VideoCandidate, VideoProductionCommand, VideoProductionActionResult } from "@/lib/video-production/workspace-types";

const id = z.uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.number().int().positive();
const commandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("generate"), memeId: id }).strict(),
  z.object({ kind: z.literal("create"), memeId: id, script: z.unknown(), assets: z.unknown() }).strict(),
  z.object({ kind: z.literal("revise"), id, expectedVersion: version, script: z.unknown(), assets: z.unknown() }).strict(),
  z.object({ kind: z.literal("render"), id, expectedVersion: version }).strict(),
  z.object({ kind: z.literal("review"), id, artifactHash: hash, decision: z.enum(["approve", "changes_requested"]), note: z.string().trim().max(1000) }).strict(),
  z.object({ kind: z.literal("upload"), id, artifactHash: hash, channelConnectionId: id, consent: z.literal(true), madeForKids: z.boolean() }).strict(),
  z.object({ kind: z.literal("publish"), publicationId: id, artifactHash: hash, visibility: z.enum(["public", "unlisted"]), studioReviewed: z.literal(true), consent: z.literal(true) }).strict(),
  z.object({ kind: z.literal("block"), id, reason: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ kind: z.literal("retry"), publicationId: id }).strict(),
  z.object({ kind: z.literal("reconcile"), publicationId: id, videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/), consent: z.literal(true) }).strict(),
]);

function reviewedAssets(value: unknown, uid: string): RightsAsset[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("invalid_assets");
  return value.map((asset) => {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) throw new Error("invalid_assets");
    const allowed = ["id", "kind", "source_url", "owner", "acquisition_method", "allow_edit", "allow_youtube", "allow_commercial", "attribution", "valid_until", "territories", "evidence"] as const;
    const result = Object.fromEntries(allowed.map((key) => [key, asset[key]]));
    // The operator's explicit permissions and evidence inputs are reviewed now;
    // caller-supplied reviewer IDs/timestamps are never trusted.
    const reviewed = asset.allow_edit === true && asset.allow_youtube === true && asset.allow_commercial === true &&
      typeof asset.evidence === "string" && asset.evidence.trim().length > 0;
    return { ...result, reviewed_by: reviewed ? uid : "", reviewed_at: reviewed ? new Date().toISOString() : "" } as unknown as RightsAsset;
  });
}

const MESSAGES: Record<string, string> = {
  operator_required: "운영자 권한이 필요합니다.", signed_out: "로그인이 필요합니다.",
  video_production_daily_limit_exhausted: "오늘의 제작 한도에 도달했습니다. 다음 운영일에 다시 시도해 주세요.",
  meme_not_production_ready: "현재 밈은 제작 조건을 충족하지 않습니다. 근거·검수·삭제 요청 상태를 확인해 주세요.",
  video_draft_provider_not_configured: "AI 대본 제공자가 설정되지 않았습니다. 수동 대본을 작성해 주세요.",
  production_not_found: "제작물을 찾을 수 없습니다.", invalid_assets: "자산 정보 형식을 확인해 주세요.",
  technical_or_rights_review_required: "불확실 주장·자산 권리·렌더 기술 검사를 먼저 확인해 주세요.",
  production_version_conflict: "다른 작업에서 제작물이 수정됐습니다. 새로고침 후 다시 확인해 주세요.",
  artifact_hash_mismatch: "미리보기와 승인 대상의 해시가 다릅니다. 최신 제작물을 다시 검수해 주세요.",
  youtube_channel_not_connected: "대상 YouTube 채널을 다시 연결해 주세요.",
  youtube_publication_not_review_ready: "비공개 영상의 처리가 완료된 뒤 공개를 승인해 주세요.",
  video_production_blocked: "삭제·차단 요청이 있는 제작물은 처리할 수 없습니다.",
  youtube_reconciliation_required: "업로드 결과 확인이 필요합니다. 새 업로드를 만들지 말고 기존 영상 ID를 확인해 주세요.",
};

function safeError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (MESSAGES[code]) return MESSAGES[code];
  if (error instanceof z.ZodError || error instanceof TypeError) return "입력값 또는 대본 형식을 확인해 주세요. 근거 ID·가상 예시 표시·장면 시간·내레이션 일치가 필요합니다.";
  return "제작 작업을 처리하지 못했습니다. 최신 상태와 서버 설정을 확인한 뒤 다시 시도해 주세요.";
}

export async function performVideoProductionCommand(input: VideoProductionCommand): Promise<VideoProductionActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("signed_out");
    const { data: operator, error: operatorError } = await supabase.rpc("is_operator");
    if (operatorError || operator !== true) throw new Error("operator_required");
    if (new TextEncoder().encode(JSON.stringify(input)).length > 128 * 1024) throw new TypeError("command_too_large");
    const command = commandSchema.parse(input);
    const client = supabase as unknown as SupabaseClient;
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error(MESSAGES[error.message] ? error.message : "video_operation_failed");
      return Array.isArray(data) ? data[0] : data;
    };
    const load = async (productionId: string) => {
      const { data, error } = await client.from("video_productions").select("id,version,status,source_snapshot,script_json,assets_json,artifact_hash,technical_check,blocked_at").eq("id", productionId).single();
      if (error || !data) throw new Error("production_not_found");
      return data;
    };
    let result: { id?: string } | undefined;
    switch (command.kind) {
      case "generate": {
        const candidate = await rpc("reserve_video_production_draft", { p_meme_id: command.memeId }) as VideoCandidate;
        const script = await generateVideoDraft(candidate, client);
        result = await rpc("create_video_production", { p_meme_id: command.memeId, p_script_json: script, p_assets_json: [],
          p_content_fingerprint: normalizedContentFingerprint(script) });
        break;
      }
      case "create": {
        const { data, error } = await client.rpc("get_video_production_candidates", { p_limit: 5 });
        if (error) throw new Error("video_operation_failed");
        const candidate = (data as VideoCandidate[] | null)?.find((row) => row.id === command.memeId);
        if (!candidate) throw new Error("meme_not_production_ready");
        const script = parseVideoScript(command.script, { allowedSourceIds: candidate.sources.map((source) => source.id) });
        const assets = reviewedAssets(command.assets, user.id);
        await rpc("reserve_video_production_draft", { p_meme_id: command.memeId });
        result = await rpc("create_video_production", { p_meme_id: command.memeId, p_script_json: script, p_assets_json: assets,
          p_content_fingerprint: normalizedContentFingerprint(script) });
        break;
      }
      case "revise": {
        const row = await load(command.id);
        const snapshot = row.source_snapshot as VideoCandidate;
        const script = parseVideoScript(command.script, { allowedSourceIds: snapshot.sources.map((source) => source.id) });
        result = await rpc("revise_video_production", { p_id: command.id, p_expected_version: command.expectedVersion, p_script_json: script,
          p_assets_json: reviewedAssets(command.assets, user.id), p_content_fingerprint: normalizedContentFingerprint(script) });
        break;
      }
      case "render":
        result = await rpc("queue_video_production_render", { p_id: command.id, p_expected_version: command.expectedVersion });
        break;
      case "review": {
        const row = await load(command.id);
        if (row.artifact_hash !== command.artifactHash) throw new Error("artifact_hash_mismatch");
        const check = row.technical_check;
        const technicalCheck = check && { duration_ms: check.duration_ms, width: check.width, height: check.height,
          has_audio: check.has_audio, decodable: check.decodable, captions_safe: check.captions_safe,
          ...(check.passed !== undefined ? { passed: check.passed } : {}) };
        if (command.decision === "approve" && !productionReadiness({ script: row.script_json, assets: row.assets_json, blocked: Boolean(row.blocked_at),
          artifactHash: row.artifact_hash, approvedArtifactHash: command.artifactHash, technicalCheck }).ready) {
          throw new Error("technical_or_rights_review_required");
        }
        result = await rpc("review_video_production", { p_id: command.id, p_artifact_hash: command.artifactHash, p_decision: command.decision, p_note: command.note });
        break;
      }
      case "upload": {
        const { data: channel, error } = await client.from("youtube_channel_connections_safe").select("channel_id").eq("id", command.channelConnectionId).single();
        const expected = process.env.YOUTUBE_EXPECTED_CHANNEL_ID?.trim() || "UCBxN8lUb-5dDuOPv-szpF4g";
        if (error || channel?.channel_id !== expected) throw new Error("youtube_channel_not_connected");
        result = await rpc("queue_youtube_publication", { p_production_id: command.id, p_channel_connection_id: command.channelConnectionId,
          p_artifact_hash: command.artifactHash, p_made_for_kids: command.madeForKids });
        break;
      }
      case "publish":
        result = await rpc("approve_youtube_publication", { p_id: command.publicationId, p_artifact_hash: command.artifactHash,
          p_visibility: command.visibility, p_studio_reviewed: command.studioReviewed });
        break;
      case "block":
        result = await rpc("block_video_production", { p_id: command.id, p_reason: command.reason });
        // End public exposure in both localized routes and cache before remote withdrawal.
        revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
        revalidatePath("/memes/[key]", "page");
        revalidatePath("/[locale]/memes/[key]", "page");
        break;
      case "retry":
        result = await rpc("retry_youtube_publication", { p_id: command.publicationId });
        break;
      case "reconcile":
        result = await rpc("reconcile_youtube_publication", { p_id: command.publicationId, p_video_id: command.videoId });
        break;
    }
    revalidatePath("/admin/video-productions");
    return { ok: true, ...(result?.id ? { id: result.id } : {}) };
  } catch (error) { return { ok: false, error: safeError(error) }; }
}
