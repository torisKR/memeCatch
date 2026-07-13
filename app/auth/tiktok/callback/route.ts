import { NextResponse, type NextRequest } from "next/server";
import {
  getTikTokRedirectUri,
  signInWithTikTokCode,
} from "@/lib/tiktok-auth.server";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get("tiktok_oauth_state")?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.cookies.get("tiktok_oauth_next")?.value);
  const redirectUri = getTikTokRedirectUri();

  let success = false;
  if (
    expectedState &&
    returnedState &&
    expectedState === returnedState &&
    code &&
    redirectUri &&
    !request.nextUrl.searchParams.has("error")
  ) {
    try {
      await signInWithTikTokCode(code, redirectUri);
      success = true;
    } catch {
      success = false;
    }
  }

  const destination = success
    ? new URL(next, request.url)
    : new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, request.url);
  const response = NextResponse.redirect(destination);
  response.cookies.set("tiktok_oauth_state", "", {
    path: "/auth/tiktok",
    maxAge: 0,
  });
  response.cookies.set("tiktok_oauth_next", "", {
    path: "/auth/tiktok",
    maxAge: 0,
  });
  return response;
}
