import "server-only";

import { createStaticClient } from "@/lib/db/server";
import type { MemeDetail } from "@/lib/queries";

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function validContent(value: unknown, memeId: string): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && row.meme_id === memeId &&
    typeof row.type === "string" && ["image", "video", "audio", "text", "embed"].includes(row.type) &&
    typeof row.availability === "string" && ["live", "dead", "region_blocked", "unchecked"].includes(row.availability) &&
    row.moderation_status === "approved" && typeof row.is_representative === "boolean" &&
    typeof row.manual_video_verified === "boolean" &&
    ["platform", "content_id", "url", "thumbnail_url", "caption"].every((key) => nullableString(row[key]));
}

type MediaSnapshot =
  | { status: "ok"; media: Pick<MemeDetail, "meme_contents" | "meme_sources"> }
  | { status: "not_public" }
  | { status: "unavailable"; reason: "query_error" | "invalid_response" };

/** Current public media for the cached Korean document; no persistent media cache. */
export async function getKoreanMediaSnapshot(memeId: string): Promise<MediaSnapshot> {
  try {
    const { data, error } = await createStaticClient().from("memes")
      .select("id, meme_contents(*), meme_sources(*)")
      .eq("id", memeId).in("moderation_status", ["approved", "limited"]).maybeSingle();
    if (error) return { status: "unavailable", reason: "query_error" };
    if (data === null) return { status: "not_public" };
    if (!data || typeof data !== "object") return { status: "unavailable", reason: "invalid_response" };
    const result = data as unknown as Record<string, unknown>;
    if (result.id !== memeId || !Array.isArray(result.meme_contents) || !result.meme_contents.every((row) => validContent(row, memeId)) || !Array.isArray(result.meme_sources) || !result.meme_sources.every((row: unknown) => row && typeof row === "object" && (row as Record<string, unknown>).meme_id === memeId && nullableString((row as Record<string, unknown>).source_url))) return { status: "unavailable", reason: "invalid_response" };
    return { status: "ok", media: { meme_contents: result.meme_contents, meme_sources: result.meme_sources } as Pick<MemeDetail, "meme_contents" | "meme_sources"> };
  } catch {
    return { status: "unavailable", reason: "query_error" };
  }
}
