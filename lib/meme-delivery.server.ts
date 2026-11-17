import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/db/admin";
import type {
  ReviewedMediaSource,
  ReviewedMediaSourceLookup,
} from "@/lib/meme-delivery";

type ReviewedMediaRow = {
  review_state: string;
  rights_basis: string;
  media_sources: Omit<ReviewedMediaSource, "review_state" | "rights_basis"> | null;
};

/** Server-only projection of reviewed provenance used by public detail delivery. */
export const getReviewedMemeMediaSources = cache(async function getReviewedMemeMediaSources(
  memeId: string,
): Promise<ReviewedMediaSourceLookup> {
  if (!memeId) return { ok: true, sources: [] };
  try {
    const { data, error } = await createAdminClient()
      .from("meme_media")
      .select(
        "review_state, rights_basis, media_sources!inner(platform, external_id, canonical_url, embeddable, public_status, removed_at, last_checked_at)",
      )
      .eq("meme_id", memeId);
    if (error || !data) return { ok: false, sources: [] };

    const sources = (data as unknown as ReviewedMediaRow[]).flatMap((row) => {
      if (!row.media_sources) return [];
      return [{
        review_state: row.review_state,
        rights_basis: row.rights_basis,
        ...row.media_sources,
      }];
    });
    return { ok: true, sources };
  } catch {
    return { ok: false, sources: [] };
  }
});
