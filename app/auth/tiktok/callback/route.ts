import { NextResponse, type NextRequest } from "next/server";
import {
  getTikTokRedirectUri,
  importTikTokVideosAsSubmissions,
  isValidTikTokOAuthState,
  signInWithTikTokCode,
} from "@/lib/tiktok-auth.server";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get("tiktok_oauth_state")?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.cookies.get("tiktok_oauth_next")?.value);
  const importVideos = request.cookies.get("tiktok_oauth_import")?.value === "1";
  const redirectUri = getTikTokRedirectUri();

  let success = false;
  let importedCount: number | null = null;
  let importFailed = false;
  if (
    isValidTikTokOAuthState(expectedState, returnedState) &&
    code &&
    redirectUri &&
    !request.nextUrl.searchParams.has("error")
  ) {
    try {
      const session = await signInWithTikTokCode(code, redirectUri);
      success = true;
      if (importVideos) {
        if (!session.scopes.has("video.list")) {
          importFailed = true;
        } else try {
          importedCount = await importTikTokVideosAsSubmissions(session);
        } catch {
          importFailed = true;
        }
      }
    } catch {
      success = false;
    }
  }

  const destination = success
    ? new URL(next, request.url)
    : new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, request.url);
  if (success && importVideos) {
    destination.searchParams.set("tiktokImport", importFailed ? "failed" : "done");
    if (importedCount != null) destination.searchParams.set("imported", String(importedCount));
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set("tiktok_oauth_state", "", {
    path: "/auth/tiktok",
    maxAge: 0,
  });
  response.cookies.set("tiktok_oauth_next", "", {
    path: "/auth/tiktok",
    maxAge: 0,
  });
  response.cookies.set("tiktok_oauth_import", "", {
    path: "/auth/tiktok",
    maxAge: 0,
  });
  return response;
}
