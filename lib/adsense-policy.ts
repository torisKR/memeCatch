import { contentDepth, type ContentDepthInput } from "./content-depth";

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

type EditorialAdContent = ContentDepthInput & {
  moderation_status?: string | null;
  title?: string | null;
  summary?: string | null;
};

/**
 * Conservative internal quality boundary, not Google's approval criteria.
 * A source and substantial editorial prose do not independently prove copyright
 * permission, factual accuracy, policy compliance, or eligibility for AdSense.
 */
export function isAdsenseContentEligible(content: EditorialAdContent | null | undefined): boolean {
  if (!content || content.moderation_status !== "approved") return false;
  const title = content.title?.trim();
  const summary = content.summary?.trim();
  if (!title || !summary || title.toLocaleLowerCase() === summary.toLocaleLowerCase()) return false;
  const depth = contentDepth(content);
  return depth.isSubstantial && depth.signals.sourceCount > 0;
}
