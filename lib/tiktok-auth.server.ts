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

export function getTikTokRedirectUri() {
  if (process.env.TIKTOK_REDIRECT_URI) return process.env.TIKTOK_REDIRECT_URI;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  return new URL("/auth/tiktok/callback", siteUrl).toString();
}

export function getTikTokClientKey() {
  return process.env.TIKTOK_CLIENT_KEY ?? null;
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
  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (sessionError) throw new Error("Supabase TikTok session failed");
}
