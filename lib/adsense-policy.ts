import { contentDepth, type ContentDepthInput } from "./content-depth";
import {
  citableSources,
  evidenceTimestamp,
  type CitableSourceInput,
} from "./source-links";

/** Public publisher identity verified against the site's ads.txt and AdSense account. */
export const ADSENSE_PUBLISHER_ID = "pub-3004906966180197";
export const ADSENSE_CLIENT_ID = `ca-${ADSENSE_PUBLISHER_ID}`;

export function isConfiguredAdsenseClient(value: string | undefined): boolean {
  return value === ADSENSE_CLIENT_ID;
}

/** Local builds can inherit production env files; never let that produce real ad requests. */
export function isLiveAdOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "catchmeme.com" || url.hostname === "www.catchmeme.com");
  } catch {
    return false;
  }
}

type EditorialAdContent = Omit<ContentDepthInput, "meme_sources"> & {
  moderation_status?: string | null;
  published_at?: string | null;
  title?: string | null;
  summary?: string | null;
  meme_sources?: CitableSourceInput[] | null;
};

/**
 * Conservative internal quality boundary, not Google's approval criteria.
 * A source and substantial editorial prose do not independently prove copyright
 * permission, factual accuracy, policy compliance, or eligibility for AdSense.
 */
export function isAdsenseContentEligible(content: EditorialAdContent | null | undefined): boolean {
  if (!content || content.moderation_status !== "approved") return false;
  if (!evidenceTimestamp(content.published_at)) return false;
  const title = content.title?.trim();
  const summary = content.summary?.trim();
  if (!title || !summary || title.toLocaleLowerCase() === summary.toLocaleLowerCase()) return false;
  const sources = citableSources(content.meme_sources ?? [])
    .map(({ url: source_url }) => ({ source_url }));
  const depth = contentDepth({ ...content, meme_sources: sources });
  return depth.isSubstantial && depth.signals.sourceCount > 0;
}
