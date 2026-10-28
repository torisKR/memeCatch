import type { VideoScript, RightsAsset } from "./core.mjs";

export type VideoSource = { id: string; title: string; url: string; approved: true };
export type VideoCandidate = {
  id: string; title: string; summary: string; description: string; origin: string;
  usage_note: string | null; caution: string | null; usage_examples: unknown;
  sources: VideoSource[]; claims: Array<{ id: string; type: string; text: string; source_id: string }>;
};
export type VideoProductionView = {
  id: string; meme_id: string; version: number; status: string; title: string;
  script: VideoScript; assets: RightsAsset[]; source_snapshot: VideoCandidate;
  artifact_hash: string | null; approved_artifact_hash: string | null;
  technical_check: Record<string, unknown>; last_error_code: string | null;
  preview_url: string | null; poster_url: string | null; created_at: string;
  blocked_at: string | null; block_reason: string | null;
};
export type YouTubeChannelView = {
  id: string; channel_id: string; title: string; connection_status: string;
  oauth_status: string; api_publication_status: string;
};
export type YouTubePublicationView = {
  id: string; production_id: string; channel_connection_id: string; artifact_hash: string;
  status: string; youtube_video_id: string | null; processing_status: string | null;
  privacy_status: string | null; embeddable: boolean | null; approved_visibility: string | null;
  studio_reviewed_at: string | null; site_linked_at: string | null; last_error_code: string | null;
};
export type VideoProductionWorkspace = {
  state: "ready" | "setup_required";
  candidates: VideoCandidate[]; productions: VideoProductionView[];
  channels: YouTubeChannelView[]; publications: YouTubePublicationView[];
  oauth_configured: boolean; draft_provider_configured: boolean; expected_channel_id: string;
  setup_notes: string[];
};
export type VideoProductionCommand =
  | { kind: "generate"; memeId: string }
  | { kind: "create"; memeId: string; script: unknown; assets: unknown }
  | { kind: "revise"; id: string; expectedVersion: number; script: unknown; assets: unknown }
  | { kind: "render"; id: string; expectedVersion: number }
  | { kind: "review"; id: string; artifactHash: string; decision: "approve" | "changes_requested"; note: string }
  | { kind: "upload"; id: string; artifactHash: string; channelConnectionId: string; consent: boolean; madeForKids: boolean }
  | { kind: "publish"; publicationId: string; artifactHash: string; visibility: "public" | "unlisted"; studioReviewed: boolean; consent: boolean }
  | { kind: "block"; id: string; reason: string }
  | { kind: "retry"; publicationId: string }
  | { kind: "reconcile"; publicationId: string; videoId: string; consent: boolean };
export type VideoProductionActionResult = { ok: true; id?: string } | { ok: false; error: string };
