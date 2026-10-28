import { NextResponse } from "next/server";
import { readBoundedJson, readBoundedText, RequestBodyTooLargeError } from "@/lib/request-body";
import { createClient } from "@/lib/supabase/server";
import {
  beginYouTubeOAuth,
  getExpectedYouTubeChannelId,
  hasTrustedYouTubeOAuthOrigin,
  validateExpectedYouTubeChannelId,
  YOUTUBE_OAUTH_STATE_COOKIE,
  YOUTUBE_OAUTH_STATE_TTL_SECONDS,
} from "@/lib/video-production/oauth.server";

export const runtime = "nodejs";

const responseHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
type ConnectInput = { expectedChannelId: string; responseKind: "form" | "json" };

async function connectInput(request: Request): Promise<ConnectInput | null> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType === "application/json") {
    const body = await readBoundedJson(request, 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || record.consent !== true || typeof record.expected_channel_id !== "string") return null;
    return { expectedChannelId: record.expected_channel_id, responseKind: "json" };
  }
  if (mediaType === "application/x-www-form-urlencoded") {
    const parameters = new URLSearchParams(await readBoundedText(request, 1024));
    if ([...parameters.keys()].length !== 2 || parameters.getAll("expected_channel_id").length !== 1 ||
        parameters.getAll("consent").length !== 1 || parameters.get("consent") !== "true") return null;
    return { expectedChannelId: parameters.get("expected_channel_id") ?? "", responseKind: "form" };
  }
  return null;
}

function approvedGoogleAuthorizationUrl(value: string, expectedState: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "accounts.google.com" || url.port || url.username || url.password ||
        url.pathname !== "/o/oauth2/v2/auth" || url.hash || url.searchParams.get("state") !== expectedState ||
        url.searchParams.get("response_type") !== "code" || !url.searchParams.get("client_id")) return null;
    return url;
  } catch { return null; }
}

function bindStateCookie(response: NextResponse, state: string) {
  response.cookies.set(YOUTUBE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/admin/video-productions/youtube/callback",
    maxAge: YOUTUBE_OAUTH_STATE_TTL_SECONDS,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedYouTubeOAuthOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: responseHeaders });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401, headers: responseHeaders });
  const { data: isOperator, error: operatorError } = await supabase.rpc("is_operator");
  if (operatorError || isOperator !== true) {
    return NextResponse.json({ error: "operator_required" }, { status: 403, headers: responseHeaders });
  }
  let input: ConnectInput | null;
  try {
    input = await connectInput(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_request" }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400,
      headers: responseHeaders,
    });
  }
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: responseHeaders });
  }
  let expectedChannelId: string;
  try {
    expectedChannelId = validateExpectedYouTubeChannelId(input.expectedChannelId);
    if (expectedChannelId !== getExpectedYouTubeChannelId()) throw new Error("channel_not_allowed");
  }
  catch { return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: responseHeaders }); }
  try {
    const started = await beginYouTubeOAuth(user.id, expectedChannelId);
    const authorizationUrl = approvedGoogleAuthorizationUrl(started.authorizationUrl, started.state);
    if (!authorizationUrl) throw new Error("invalid_authorization_url");
    const response = input.responseKind === "form"
      ? NextResponse.redirect(authorizationUrl, 303)
      : NextResponse.json({
        authorizationUrl: authorizationUrl.href,
        expiresInSeconds: YOUTUBE_OAUTH_STATE_TTL_SECONDS,
        oauthTestingNotice: "Google OAuth testing-mode refresh tokens may expire after seven days; verify the project's actual publishing status separately.",
      }, { status: 201, headers: responseHeaders });
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    bindStateCookie(response, started.state);
    return response;
  } catch {
    return NextResponse.json({ error: "youtube_oauth_unavailable" }, { status: 503, headers: responseHeaders });
  }
}
