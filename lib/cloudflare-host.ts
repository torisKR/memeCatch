export const APEX_HOST = "catchmeme.com";

/** www.catchmeme.com -> https://catchmeme.com, preserving path and query. */
export function wwwToApexRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== `www.${APEX_HOST}`) return null;
  url.hostname = APEX_HOST;
  url.protocol = "https:";
  return Response.redirect(url, 308);
}

export function releaseShaForWorker(env: {
  RELEASE_SHA?: string;
  CF_VERSION_METADATA?: { id?: string };
}): string | undefined {
  return env.RELEASE_SHA?.trim() || env.CF_VERSION_METADATA?.id?.trim() || undefined;
}

/** Fills the release header when the Next build did not already set one. */
export function withReleaseSha(response: Response, sha: string | undefined): Response {
  if (!sha || response.headers.get("X-MemeCatch-Release-Sha")) return response;
  const headers = new Headers(response.headers);
  headers.set("X-MemeCatch-Release-Sha", sha);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
