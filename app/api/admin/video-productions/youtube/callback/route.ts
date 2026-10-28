import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  completeYouTubeOAuth,
  oauthStateMatchesCookie,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "@/lib/video-production/oauth.server";

export const runtime = "nodejs";

function redirectResult(result: "connected" | "reauth") {
  const target = new URL("/admin/video-productions", SITE_URL);
  target.searchParams.set("youtube", result);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  response.cookies.set(YOUTUBE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/admin/video-productions/youtube/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  const state = request.nextUrl.searchParams.get("state") ?? "";
  if (!oauthStateMatchesCookie(state, request.cookies.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value)) {
    return redirectResult("reauth");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectResult("reauth");
  const { data: isOperator, error: operatorError } = await supabase.rpc("is_operator");
  if (operatorError || isOperator !== true) return redirectResult("reauth");
  try {
    await completeYouTubeOAuth({
      operatorId: user.id,
      state,
      code: request.nextUrl.searchParams.get("code") ?? undefined,
      providerError: request.nextUrl.searchParams.get("error") ?? undefined,
    });
    return redirectResult("connected");
  } catch {
    return redirectResult("reauth");
  }
}
