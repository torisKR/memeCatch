import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "새 비밀번호 설정",
  robots: { index: false, follow: false },
};

/**
 * 재설정 메일 링크 → /auth/callback(코드→세션 교환) → 이 페이지.
 * 세션이 없으면 링크가 만료됐거나 직접 접근한 경우이므로 재요청을 안내한다.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
        Reset
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">새 비밀번호 설정</h1>

      <div className="glass-panel mt-5 rounded-2xl p-5">
        {user ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground">{user.email}</span>{" "}
              계정의 새 비밀번호를 정해 주세요.
            </p>
            <ResetPasswordForm />
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted">
              재설정 링크가 만료됐거나 유효하지 않아요. 링크는 발송 후 1시간 동안만
              쓸 수 있어요.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98]"
            >
              재설정 메일 다시 받기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
