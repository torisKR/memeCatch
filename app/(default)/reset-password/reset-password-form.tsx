"use client";

import { useActionState, useId } from "react";
import { updatePassword, type AuthState } from "@/lib/actions/auth";

/** 새 비밀번호 설정. token은 재설정 메일 링크에서 온다. */
export function ResetPasswordForm({ token = "" }: { token?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    null
  );
  const pwId = useId();
  const confirmId = useId();

  const inputClass =
    "mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-4 focus:ring-accent/20";

  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {token ? <input type="hidden" name="token" value={token} /> : null}
      {state?.formError && (
        <p
          role="alert"
          className="rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold leading-relaxed text-safety-red"
        >
          {state.formError}
        </p>
      )}

      <div>
        <label htmlFor={pwId} className="block text-sm font-semibold">
          새 비밀번호
        </label>
        <input
          id={pwId}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          aria-invalid={!!state?.fieldErrors?.password}
          aria-describedby={
            state?.fieldErrors?.password ? `${pwId}-error` : `${pwId}-hint`
          }
          className={inputClass}
        />
        {state?.fieldErrors?.password ? (
          <p
            id={`${pwId}-error`}
            role="alert"
            className="mt-1.5 text-sm font-semibold text-safety-red"
          >
            {state.fieldErrors.password}
          </p>
        ) : (
          <p id={`${pwId}-hint`} className="mt-1.5 text-xs text-muted">
            6자 이상으로 정해 주세요.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={confirmId} className="block text-sm font-semibold">
          새 비밀번호 확인
        </label>
        <input
          id={confirmId}
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "저장 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
