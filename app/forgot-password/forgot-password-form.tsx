"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";

/**
 * 비밀번호 찾기 — 이메일로 재설정 링크 발송.
 * 서버 액션은 가입 여부와 무관하게 같은 안내를 돌려준다(계정 열거 방지).
 */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    null
  );
  const emailId = useId();
  const sent = !!state?.notice;

  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {state?.formError && (
        <p
          role="alert"
          className="rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold text-safety-red"
        >
          {state.formError}
        </p>
      )}
      {sent && (
        <p
          role="status"
          className="rounded-xl bg-safety-green-bg px-4 py-3 text-sm font-semibold leading-relaxed text-safety-green"
        >
          {state.notice}
        </p>
      )}

      <div>
        <label htmlFor={emailId} className="block text-sm font-semibold">
          이메일
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.values?.email}
          placeholder="you@example.com"
          aria-invalid={!!state?.fieldErrors?.email}
          aria-describedby={
            state?.fieldErrors?.email ? `${emailId}-error` : undefined
          }
          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
        {state?.fieldErrors?.email && (
          <p
            id={`${emailId}-error`}
            role="alert"
            className="mt-1.5 text-sm font-semibold text-safety-red"
          >
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "보내는 중…" : sent ? "다시 보내기" : "재설정 메일 받기"}
      </button>

      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-accent-text transition-colors hover:text-accent"
      >
        로그인으로 돌아가기
      </Link>
    </form>
  );
}
