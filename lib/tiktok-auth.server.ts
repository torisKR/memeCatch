import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_ENDPOINT =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";

type TikTokTokenResponse = {
  access_token?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
};

type TikTokUserResponse = {
  data?: {
    user?: {
      open_id?: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  error?: { code?: string; message?: string };
};

type TikTokVideoListResponse = {
  data?: {
    videos?: Array<{
      id?: string;
      title?: string;
      video_description?: string;
      share_url?: string;
    }>;
  };
  error?: { code?: string; message?: string };
};

export function getTikTokRedirectUri() {
  if (process.env.TIKTOK_REDIRECT_URI) return process.env.TIKTOK_REDIRECT_URI;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  return new URL("/auth/tiktok/callback", siteUrl).toString();
}

export function getTikTokClientKey() {
  return process.env.TIKTOK_CLIENT_KEY ?? null;
}

function isPublicTikTokUrl(value: string | undefined): value is string {
  if (!value || value.length > 500) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com"))
    );
  } catch {
    return false;
  }
}

async function exchangeCode(code: string, redirectUri: string) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error("TikTok login is not configured");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json().catch(() => null)) as
    | TikTokTokenResponse
    | null;
  if (!response.ok || !result?.access_token || !result.open_id) {
    throw new Error(result?.error_description ?? "TikTok token exchange failed");
  }
  return { accessToken: result.access_token, openId: result.open_id };
}

async function fetchTikTokUser(accessToken: string, expectedOpenId: string) {
  const response = await fetch(USER_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json().catch(() => null)) as
    | TikTokUserResponse
    | null;
  const user = result?.data?.user;
  if (!response.ok || !user?.open_id || user.open_id !== expectedOpenId) {
    throw new Error(result?.error?.message ?? "TikTok user lookup failed");
  }
  return user;
}

/** TikTok 신원을 내부 Supabase 사용자로 연결하고 현재 응답에 세션 쿠키를 설정한다. */
export async function signInWithTikTokCode(code: string, redirectUri: string) {
  const { accessToken, openId } = await exchangeCode(code, redirectUri);
  const tiktokUser = await fetchTikTokUser(accessToken, openId);

  // TikTok open_id 원문을 이메일 식별자에 노출하지 않는다.
  const subject = createHash("sha256").update(openId).digest("hex").slice(0, 40);
  const email = `tiktok_${subject}@auth.memecatch.internal`;
  const nickname = tiktokUser.display_name?.trim().slice(0, 20) || `틱톡러_${subject.slice(0, 6)}`;

  const admin = createAdminClient();
  const { data: link, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: {
          nickname,
          auth_source: "tiktok",
          tiktok_subject: subject,
          avatar_url: tiktokUser.avatar_url ?? null,
        },
      },
    });
  if (linkError || !link.properties?.hashed_token) {
    throw new Error("Supabase TikTok account link failed");
  }

  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (sessionError || !sessionData.user) {
    throw new Error("Supabase TikTok session failed");
  }

  return { accessToken, userId: sessionData.user.id };
}

/**
 * 사용자가 OAuth 화면에서 video.list 권한을 명시적으로 허용했을 때만 호출한다.
 * 토큰은 이 요청 안에서만 사용하며 저장하지 않는다. 가져온 영상은 자동 공개가 아닌
 * 검수 대기 제보로만 기록한다.
 */
export async function importTikTokVideosAsSubmissions({
  accessToken,
  userId,
}: {
  accessToken: string;
  userId: string;
}) {
  const endpoint = new URL("https://open.tiktokapis.com/v2/video/list/");
  endpoint.searchParams.set("fields", "id,title,video_description,share_url");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ max_count: 20 }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json().catch(() => null)) as TikTokVideoListResponse | null;
  const videos = result?.data?.videos ?? [];
  if (!response.ok || (result?.error?.code && result.error.code !== "ok")) {
    throw new Error(result?.error?.message ?? "TikTok 영상을 가져오지 못했습니다");
  }

  const candidates = videos.flatMap((video) => {
    if (!video.id || !isPublicTikTokUrl(video.share_url)) return [];
    return [{
      sourceUrl: video.share_url,
      name: video.title?.trim().slice(0, 100) || `TikTok 영상 ${video.id}`,
      description:
        video.video_description?.trim().slice(0, 2_000) ||
        "TikTok에서 본인 계정이 video.list 권한으로 가져온 공개 영상입니다.",
    }];
  });
  if (candidates.length === 0) return 0;

  const admin = createAdminClient();
  const urls = candidates.map((candidate) => candidate.sourceUrl);
  const [{ data: submitted }, { data: existingContents }] = await Promise.all([
    admin.from("meme_submissions").select("source_url").in("source_url", urls),
    admin.from("meme_contents").select("url").in("url", urls),
  ]);
  const occupied = new Set([
    ...(submitted ?? []).map((row) => row.source_url),
    ...(existingContents ?? []).map((row) => row.url),
  ]);
  const rows = candidates
    .filter((candidate) => !occupied.has(candidate.sourceUrl))
    .map((candidate) => ({
      submitter_id: userId,
      name: candidate.name,
      source_url: candidate.sourceUrl,
      description: candidate.description,
      guess_reason: "TikTok video.list에서 본인 동의로 가져옴",
      tags: ["tiktok", "oauth-import"],
      status: "pending" as const,
    }));
  if (rows.length === 0) return 0;

  const { error } = await admin.from("meme_submissions").insert(rows);
  if (error) throw new Error("TikTok 영상 제보를 저장하지 못했습니다");
  return rows.length;
}
