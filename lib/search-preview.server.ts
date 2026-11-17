import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { isValidReviewedMediaSource, resolveMemeDelivery, type ReviewedMediaSource } from "@/lib/meme-delivery";
import type { MemeListItem } from "@/lib/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 200;
type PreviewContents = MemeListItem["meme_contents"];

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function validContents(value: unknown): value is NonNullable<PreviewContents> {
  if (!Array.isArray(value)) return false;
  return value.every((item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return ["url", "content_id", "platform", "thumbnail_url", "availability", "moderation_status"].every((key) => row[key] === undefined || nullableString(row[key])) &&
      (row.type === undefined || (typeof row.type === "string" && ["image", "video", "audio", "text", "embed"].includes(row.type))) &&
      ["is_representative", "manual_video_verified"].every((key) => row[key] == null || typeof row[key] === "boolean");
  });
}

/** A malformed ledger response must not be confused with a successful empty ledger. */
function parseRow(value: unknown, ids: ReadonlySet<string>): { id: string; source: ReviewedMediaSource } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.meme_id !== "string" || !ids.has(row.meme_id) || typeof row.review_state !== "string" || typeof row.rights_basis !== "string" || !row.media_sources || typeof row.media_sources !== "object") return null;
  const source = row.media_sources as Record<string, unknown>;
  if (typeof source.platform !== "string" || typeof source.canonical_url !== "string" || !nullableString(source.external_id) || !nullableString(source.public_status) || !nullableString(source.removed_at) || !nullableString(source.last_checked_at) || !(source.embeddable === null || typeof source.embeddable === "boolean")) return null;
  const projected = { ...source, review_state: row.review_state, rights_basis: row.rights_basis };
  return isValidReviewedMediaSource(projected) ? { id: row.meme_id, source: projected } : null;
}

/** One server-only ledger query per bounded batch, with no persistent rights cache. */
export async function qualifySearchPreviews(
  cards: readonly MemeListItem[],
  options: { client?: Pick<ReturnType<typeof createAdminClient>, "from">; signal?: AbortSignal; onFailure?: () => void } = {},
): Promise<(PreviewContents | undefined)[]> {
  const ids = [...new Set(cards.map((card) => card?.id).filter((id): id is string => typeof id === "string" && UUID.test(id)))];
  const grouped = new Map<string, ReviewedMediaSource[]>();
  const failed = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    const chunk = ids.slice(offset, offset + BATCH_SIZE);
    const allowed = new Set(chunk);
    try {
      const query = (options.client ?? createAdminClient()).from("meme_media").select(
        "meme_id, review_state, rights_basis, media_sources!inner(platform, external_id, canonical_url, embeddable, public_status, removed_at, last_checked_at)",
      ).in("meme_id", chunk);
      const { data, error } = await (options.signal ? query.abortSignal(options.signal) : query);
      if (error || !Array.isArray(data)) throw new Error("ledger_unavailable");
      let malformedCount = 0;
      for (const value of data) {
        const id = value && typeof value === "object" ? (value as Record<string, unknown>).meme_id : null;
        if (typeof id !== "string" || !allowed.has(id)) throw new Error("invalid_ledger_response");
        const row = parseRow(value, allowed);
        if (!row) {
          failed.add(id);
          malformedCount += 1;
          continue;
        }
        const sources = grouped.get(row.id) ?? [];
        sources.push(row.source);
        grouped.set(row.id, sources);
      }
      if (malformedCount) console.warn(`[search-preview] malformed ledger rows: ${malformedCount}`);
      if (malformedCount) options.onFailure?.();
    } catch {
      options.onFailure?.();
      console.warn("[search-preview] ledger batch unavailable");
      for (const id of chunk) failed.add(id);
    }
  }
  return cards.map((card) => {
    if (!card || typeof card.id !== "string") return [];
    if (card.id.startsWith("curated-")) return undefined;
    if (!UUID.test(card.id) || failed.has(card.id)) return [];
    const contents = card.meme_contents ?? [];
    if (!validContents(contents)) return [];
    const delivery = resolveMemeDelivery({ contents, sources: [], reviewedMediaSources: { ok: true, sources: grouped.get(card.id) ?? [] } });
    if (!delivery.representative || !delivery.embeddingAllowed) return [];
    return [delivery.representative];
  });
}
