"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { SITE_URL } from "@/lib/site";

export type AuthState = {
  fieldErrors?: { email?: string; password?: string; nickname?: string };
  formError?: string;
  /** 성공 안내(오류 아님) — 재설정 메일 발송처럼 폼을 떠나지 않는 완료 상태 */
  notice?: string;
  values?: { email?: string; nickname?: string };
} | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_AUTH_DOMAIN = "@auth.memecatch.internal";
const SIGNUP_NOTICE =
  "가입 요청을 접수했어요. 가입 가능한 이메일이면 안내 메일을 확인하거나 로그인해 주세요.";

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const fieldErrors: NonNullable<AuthState>["fieldErrors"] = {};
  if (!email) fieldErrors.email = "이메일을 입력해 주세요";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "이메일 형식이 맞지 않아요";
  if (!password) fieldErrors.password = "비밀번호를 입력해 주세요";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      formError: "이메일 또는 비밀번호가 맞지 않아요",
      values: { email },
    };
  }

  redirect(next);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: NonNullable<AuthState>["fieldErrors"] = {};
  if (nickname.length < 2 || nickname.length > 20) {
    fieldErrors.nickname = "닉네임은 2~20자로 지어 주세요";
  }
  if (!email) fieldErrors.email = "이메일을 입력해 주세요";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "이메일 형식이 맞지 않아요";
  else if (email.toLowerCase().endsWith(INTERNAL_AUTH_DOMAIN)) {
    fieldErrors.email = "가입할 수 없는 이메일 도메인이에요";
  }
  if (password.length < 6) fieldErrors.password = "비밀번호는 6자 이상이어야 해요";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: { email, nickname } };
  }

  const supabase = await createClient();
  let providerFailed = false;
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    });
    providerFailed = !!error;
  } catch {
    providerFailed = true;
  }
  if (providerFailed) console.error({ event: "auth_signup_provider_failed" });
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw new Error("가입 세션 정리에 실패했어요.");
  return { notice: SIGNUP_NOTICE, values: { email, nickname } };
}

const AGE_GROUPS = ["10s", "20s", "30s", "40s", "50s+"] as const;
const CATEGORIES = [
  "phrase",
  "dance",
  "song",
  "image",
  "comment",
  "challenge",
] as const;
const USE_PURPOSES = ["creator", "brand", "global"] as const;
const PLATFORMS = ["instagram", "tiktok", "x", "youtube"] as const;

function parseOnboardingPreferences(formData: FormData) {
  const rawPurpose = String(formData.get("use_purpose") ?? "");
  return {
    interests: formData
      .getAll("interests")
      .map(String)
      .filter((value) => (CATEGORIES as readonly string[]).includes(value)),
    age_group: (AGE_GROUPS as readonly string[]).includes(String(formData.get("age_group") ?? ""))
      ? String(formData.get("age_group"))
      : null,
    use_purpose: (USE_PURPOSES as readonly string[]).includes(rawPurpose) ? rawPurpose : "creator",
    preferred_platforms: formData
      .getAll("preferred_platforms")
      .map(String)
      .filter((value) => (PLATFORMS as readonly string[]).includes(value)),
  };
}

/** 온보딩 — 관심 카테고리(다중) + 연령대(선택) 저장. Skip 가능. */
export async function completeOnboarding(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const preferences = parseOnboardingPreferences(formData);
  const nickname = String(formData.get("nickname") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      ...preferences,
      ...(nickname.length >= 2 && nickname.length <= 20 ? { nickname } : {}),
    })
    .eq("id", user.id);
  if (error) throw error;

  redirect(next);
}

/**
 * 비밀번호 재설정 메일 발송.
 * 가입 여부와 무관하게 항상 동일한 안내를 돌려준다 — 응답 차이로 특정 이메일의
 * 가입 여부를 알아내는 계정 열거(account enumeration)를 막기 위함.
 * 메일 링크는 /auth/callback으로 들어와 코드를 세션으로 교환한 뒤 /reset-password로 간다.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) return { fieldErrors: { email: "이메일을 입력해 주세요" } };
  if (!EMAIL_RE.test(email)) {
    return {
      fieldErrors: { email: "이메일 형식이 맞지 않아요" },
      values: { email },
    };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  return {
    notice:
      "재설정 메일을 보냈어요. 메일함(스팸함도 함께) 을 확인해 주세요. 링크는 1시간 동안 유효해요.",
    values: { email },
  };
}

/**
 * 새 비밀번호 저장 — 재설정 메일 링크로 만들어진 세션이 있을 때만 동작한다.
 * 세션이 없으면(링크 만료·직접 접근) 변경하지 않고 재요청을 안내한다.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { fieldErrors: { password: "비밀번호는 6자 이상이어야 해요" } };
  }
  if (password !== confirm) {
    return { fieldErrors: { password: "두 비밀번호가 서로 달라요" } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      formError:
        "재설정 링크가 만료됐거나 유효하지 않아요. 메일을 다시 요청해 주세요.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      formError: "비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  redirect("/my");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateNickname(formData: FormData): Promise<void> {
  const nickname = String(formData.get("nickname") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my");

  if (nickname.length < 2 || nickname.length > 20) {
    redirect(
      `/my?nickname_error=${encodeURIComponent("닉네임은 2~20자로 지어 주세요")}`
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", user.id);

  if (error) {
    const message =
      error.code === "23505"
        ? "이미 사용 중인 닉네임이에요"
        : "닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요";
    redirect(`/my?nickname_error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/my");
  redirect("/my?nickname_saved=1");
}

export async function updateProfileCustomization(
  formData: FormData
): Promise<void> {
  const flairRaw = String(formData.get("flair") ?? "").trim();
  const accentRaw = String(formData.get("accent") ?? "").trim();
  const flair = flairRaw.length > 0 ? flairRaw : null;
  const accent = accentRaw.length > 0 ? accentRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my");

  // 클라이언트 사전 검증 (RPC가 최종 강제하지만 즉각 피드백용)
  if (flair && flair.length > 24) {
    redirect(`/my?custom_error=flair_too_long`);
  }
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    redirect(`/my?custom_error=invalid_color`);
  }

  const { error } = await supabase.rpc("update_profile_customization", {
    p_flair: flair,
    p_accent: accent,
  });

  if (error) {
    // plus_required / auth_required / 기타 → 저장 실패로 통일 표기
    redirect(`/my?custom_error=save_failed`);
  }

  revalidatePath("/my");
  redirect("/my?custom_saved=1");
}
