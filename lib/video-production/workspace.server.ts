import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { videoDraftProviderConfigured } from "./draft.server";
import { isYouTubeOAuthConfigured, getExpectedYouTubeChannelId } from "./oauth.server";
import type { VideoCandidate, VideoProductionView, VideoProductionWorkspace,
  YouTubeChannelView, YouTubePublicationView } from "./workspace-types";
import type { RightsAsset, VideoScript } from "./core.mjs";

type ProductionRecord = {
  id: string; meme_id: string; version: number; status: string; source_snapshot: VideoCandidate;
  script_json: VideoScript; assets_json: RightsAsset[]; artifact_key: string | null; poster_key?: string | null;
  artifact_hash: string | null; approved_artifact_hash: string | null; technical_check: Record<string, unknown>;
  errors: Array<{ code?: string }>; created_at: string; blocked_at: string | null; block_reason: string | null;
};

export async function getVideoProductionWorkspace(): Promise<VideoProductionWorkspace> {
  const { supabase } = await requireOperatorPage("/admin/video-productions");
  const client = supabase as unknown as SupabaseClient;
  let expectedChannelId = "";
  try { expectedChannelId = getExpectedYouTubeChannelId(); } catch { /* Invalid configuration disables actions, not the admin page. */ }
  const config = { oauth_configured: isYouTubeOAuthConfigured(), draft_provider_configured: videoDraftProviderConfigured(),
    expected_channel_id: expectedChannelId };
  const notes = [!config.oauth_configured && "YouTube OAuth 클라이언트·리디렉션 URI·토큰 암호화 키 설정이 필요합니다.",
    !expectedChannelId && "대상 YouTube 채널 ID 설정이 올바르지 않습니다. 연결·업로드는 비활성화됩니다.",
    !config.draft_provider_configured && "AI 대본 제공자가 설정되지 않았습니다. 수동 대본 작성은 가능합니다.",
    "OAuth 앱의 Testing 상태·토큰 만료와 실제 채널 공개 제한은 별도로 확인해야 합니다."].filter((item): item is string => Boolean(item));
  const [candidates, productions, channels, publications] = await Promise.all([
    client.rpc("get_video_production_candidates", { p_limit: 5 }),
    client.from("video_productions").select("id,meme_id,version,status,source_snapshot,script_json,assets_json,artifact_key,poster_key,artifact_hash,approved_artifact_hash,technical_check,errors,created_at,blocked_at,block_reason").order("created_at", { ascending: false }).limit(40).returns<ProductionRecord[]>(),
    client.from("youtube_channel_connections_safe").select("id,channel_id,title,connection_status,oauth_status,api_publication_status").returns<YouTubeChannelView[]>(),
    client.from("youtube_publications").select("id,production_id,channel_connection_id,artifact_hash,status,youtube_video_id,processing_status,privacy_status,embeddable,approved_visibility,studio_reviewed_at,site_linked_at,last_error_code").order("created_at", { ascending: false }).limit(100).returns<YouTubePublicationView[]>(),
  ]);
  const errors = [candidates.error, productions.error, channels.error, publications.error].filter(Boolean);
  if (errors.length) {
    const missingSchema = errors.every((error) => ["42P01", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(error!.code));
    return { state: "setup_required", ...config, candidates: [], productions: [], channels: [], publications: [],
      setup_notes: [...notes, missingSchema ? "영상 제작·발행 DB 마이그레이션이 아직 적용되지 않았습니다. 운영 활성화 전 격리 DB 검증과 적용이 필요합니다."
        : "제작 원장을 불러오지 못했습니다. 연결·권한을 확인하고 다시 시도해 주세요."] };
  }
  const storage = (createAdminClient() as unknown as SupabaseClient).storage.from("video-production-private");
  const views: VideoProductionView[] = await Promise.all((productions.data ?? []).map(async (row) => {
    const sign = async (key: string | null | undefined) => {
      if (!key || row.blocked_at || !key.startsWith(`${row.id}/`)) return null;
      const { data, error } = await storage.createSignedUrl(key, 300);
      return error ? null : data?.signedUrl ?? null;
    };
    return { id: row.id, meme_id: row.meme_id, version: row.version, status: row.status, title: row.script_json.title,
      script: row.script_json, assets: row.assets_json, source_snapshot: row.source_snapshot,
      artifact_hash: row.artifact_hash, approved_artifact_hash: row.approved_artifact_hash, technical_check: row.technical_check,
      last_error_code: row.errors?.at(-1)?.code ?? null, preview_url: await sign(row.artifact_key), poster_url: await sign(row.poster_key),
      created_at: row.created_at, blocked_at: row.blocked_at, block_reason: row.block_reason };
  }));
  return { state: "ready", ...config, candidates: Array.isArray(candidates.data) ? candidates.data as VideoCandidate[] : [],
    productions: views,
    channels: (channels.data ?? []).map((row) => ({ id: row.id, channel_id: row.channel_id, title: row.title,
      connection_status: row.connection_status, oauth_status: row.oauth_status, api_publication_status: row.api_publication_status })),
    publications: (publications.data ?? []).map((row) => ({ id: row.id, production_id: row.production_id,
      channel_connection_id: row.channel_connection_id, artifact_hash: row.artifact_hash, status: row.status,
      youtube_video_id: row.youtube_video_id, processing_status: row.processing_status, privacy_status: row.privacy_status,
      embeddable: row.embeddable, approved_visibility: row.approved_visibility, studio_reviewed_at: row.studio_reviewed_at,
      site_linked_at: row.site_linked_at, last_error_code: row.last_error_code })), setup_notes: notes };
}
