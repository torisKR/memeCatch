import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  getTikTokClientKey,
  getTikTokRedirectUri,
} from "@/lib/tiktok-auth.server";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const clientKey = getTikTokClientKey();
  const redirectUri = getTikTokRedirectUri();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const importVideos = request.nextUrl.searchParams.get("import") === "1";
  if (!clientKey || !redirectUri) {
    return NextResponse.redirect(
      new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, request.url)
    );
  }

  const state = randomBytes(32).toString("base64url");
  const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorizeUrl.searchParams.set("client_key", clientKey);
  authorizeUrl.searchParams.set(
    "scope",
    importVideos ? "user.info.basic,video.list" : "user.info.basic"
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/auth/tiktok",
    maxAge: 10 * 60,
  };
  response.cookies.set("tiktok_oauth_state", state, cookieOptions);
  response.cookies.set("tiktok_oauth_next", next, cookieOptions);
  response.cookies.set("tiktok_oauth_import", importVideos ? "1" : "", cookieOptions);
  return response;
}
