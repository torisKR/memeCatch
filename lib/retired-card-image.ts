const VERIFIED_PUBLIC_IMAGE = /^\/(?:ai-memes|images\/originals)\/[a-z0-9-]+\.(?:jpg|png)$/;

/** YouTube stills are not card art. They carry a duration overlay and are not owned illustrations. */
export function isYouTubeThumbnailUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://catchmeme.com");
    const host = url.hostname.toLowerCase();
    return (
      host === "i.ytimg.com" ||
      host === "img.youtube.com" ||
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host.endsWith(".ytimg.com")
    );
  } catch {
    return false;
  }
}

/**
 * A 410 card may show an image only when it is a same-origin file we ship.
 * Anything else, including a YouTube still, is unverified and stays off the page.
 */
export function verifiedRetiredCardImage(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || isYouTubeThumbnailUrl(trimmed)) return null;
  if (!VERIFIED_PUBLIC_IMAGE.test(trimmed)) return null;
  return trimmed;
}
