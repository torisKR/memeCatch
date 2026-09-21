import { SITE_URL } from "@/lib/site";

/**
 * Require browser-verified same-origin context before using cookie credentials
 * for a state-changing request. The request URL keeps local/preview deployments
 * working behind a proxy, while SITE_URL covers a canonical origin forwarded to
 * a different internal request URL.
 */
export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const allowedOrigins = new Set([
        new URL(request.url).origin,
        new URL(SITE_URL).origin,
      ]);
      return allowedOrigins.has(origin);
    } catch {
      return false;
    }
  }

  return request.headers.get("sec-fetch-site") === "same-origin";
}
