import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
import { parseProducedVideoMetadata, type ProducedVideoSchemaMetadata } from "./video-schema.mjs";

export type PublicMemeProducedVideo = {
  meme_id: string;
  production_id: string;
  youtube_video_id: string;
  content_id: string;
  caption: string | null;
  privacy_status: "public";
  site_linked_at: string;
  public_embed_verified: boolean;
  schema_metadata: Readonly<ProducedVideoSchemaMetadata> | null;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function projectionNotInstalled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as Record<string, unknown>).code;
  // PostgreSQL/PostgREST missing relation or newly added projection columns.
  return code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204";
}

function projectionFailure(failure: "projection_not_installed" | "query_error" | "missing_data" | "exception"): [] {
  // Provider errors may contain URLs/credentials. Record only the bounded failure stage.
  console.error("[meme-produced-videos] public projection unavailable", { failure });
  return [];
}

function toRow(value: unknown, memeId: string): PublicMemeProducedVideo | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!(
    row.meme_id === memeId &&
    typeof row.production_id === "string" && row.production_id.trim() !== "" &&
    typeof row.youtube_video_id === "string" &&
    VIDEO_ID.test(row.youtube_video_id) &&
    typeof row.content_id === "string" && row.content_id.trim() !== "" &&
    row.privacy_status === "public" &&
    typeof row.site_linked_at === "string" &&
    row.site_linked_at.trim() !== "" &&
    Number.isFinite(Date.parse(row.site_linked_at))
  )) return null;
  return {
    meme_id: memeId,
    production_id: row.production_id,
    youtube_video_id: row.youtube_video_id,
    content_id: row.content_id,
    caption: typeof row.caption === "string" ? row.caption : null,
    privacy_status: row.privacy_status,
    site_linked_at: row.site_linked_at,
    public_embed_verified: row.public_embed_verified === true,
    schema_metadata: row.public_embed_verified === true
      ? parseProducedVideoMetadata({ name: row.video_name, description: row.video_description,
        thumbnailUrl: row.video_thumbnail_url, uploadDate: row.video_upload_date }, row.youtube_video_id)
      : null,
  };
}

/** Public projection only. It is deliberately separate from original-source delivery and claims. */
export async function getPublicMemeProducedVideos(memeId: string): Promise<PublicMemeProducedVideo[]> {
  if (!memeId.trim()) return [];
  try {
    const client = createStaticClient({ cachePublicCatalog: true }) as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
    const { data, error } = await client
      .from("public_meme_produced_videos")
      .select("meme_id, production_id, youtube_video_id, content_id, caption, privacy_status, site_linked_at, public_embed_verified, video_name, video_description, video_thumbnail_url, video_upload_date")
      .eq("meme_id", memeId)
      .order("site_linked_at", { ascending: false });
    if (error) return projectionFailure(projectionNotInstalled(error) ? "projection_not_installed" : "query_error");
    if (!Array.isArray(data)) return projectionFailure("missing_data");
    const seen = new Set<string>();
    return data.map((row) => toRow(row, memeId)).filter((row): row is PublicMemeProducedVideo => {
      if (!row || seen.has(row.youtube_video_id)) return false;
      seen.add(row.youtube_video_id);
      return true;
    });
  } catch (error) {
    // Keep detail healthy while recording a bounded, non-sensitive failure stage.
    return projectionFailure(projectionNotInstalled(error) ? "projection_not_installed" : "exception");
  }
}
