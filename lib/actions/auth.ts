"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  fieldErrors?: { email?: string; password?: string; nickname?: string };
  formError?: string;
  values?: { email?: string; nickname?: string };
} | null;

/** open redirect 방지 — 내부 경로만 허용 */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const next = safeNext(formData.get("next"));

  const fieldErrors: NonNullable<AuthState>["fieldErrors"] = {};
  if (nickname.length < 2 || nickname.length > 20) {
    fieldErrors.nickname = "닉네임은 2~20자로 지어 주세요";
  }
  if (!email) fieldErrors.email = "이메일을 입력해 주세요";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "이메일 형식이 맞지 않아요";
  if (password.length < 6) fieldErrors.password = "비밀번호는 6자 이상이어야 해요";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: { email, nickname } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });

  if (error) {
    if (/already registered/i.test(error.message)) {
      return {
        formError: "이미 가입된 이메일이에요. 로그인해 주세요",
        values: { email, nickname },
      };
    }
    if (/database error/i.test(error.message)) {
      return {
        fieldErrors: { nickname: "이미 사용 중인 닉네임이에요. 다른 닉네임을 지어 주세요" },
        values: { email, nickname },
      };
    }
    return {
      formError: "가입에 실패했어요. 잠시 후 다시 시도해 주세요",
      values: { email, nickname },
    };
  }

  // 이메일 확인이 켜져 있는 환경 대비 (로컬은 confirm off → 즉시 세션)
  if (!data.session) {
    return {
      formError: "가입 확인 메일을 보냈어요. 메일함을 확인해 주세요",
      values: { email, nickname },
    };
  }

  redirect(next);
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
