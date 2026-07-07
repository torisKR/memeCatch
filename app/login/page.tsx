"use client";

import { use, useActionState, useId, useState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

type Mode = "login" | "signup";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = use(searchParams);
  const rawNext = typeof sp.next === "string" ? sp.next : "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const callbackError = sp.error === "auth";
  const [mode, setMode] = useState<Mode>("login");

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "다시 만나서 반가워요" : "밈캐치에 어서 오세요"}
      </h1>
      <p className="mt-2 text-muted">
        {mode === "login"
          ? "로그인하면 밈 저장과 제보를 이어서 할 수 있어요."
          : "가입하면 밈을 저장하고 직접 제보할 수 있어요."}
      </p>

      {callbackError && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red"
        >
          로그인 링크가 만료됐거나 잘못됐어요. 다시 로그인해 주세요.
        </p>
      )}

      <div
        role="tablist"
        aria-label="로그인 방법 선택"
        className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1"
      >
        {(
          [
            ["login", "로그인"],
            ["signup", "가입하기"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={`min-h-11 rounded-lg text-base font-semibold transition-colors ${
              mode === key ? "bg-surface text-foreground shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {mode === "login" ? <LoginForm next={next} /> : <SignupForm next={next} />}
      </div>

      <p className="mt-8 text-center text-muted">
        <Link href="/" className="underline underline-offset-4">
          로그인 없이 둘러보기
        </Link>
      </p>
    </main>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted";

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red">
      {message}
    </p>
  );
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-white disabled:opacity-60"
    >
      {pending && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);
  const emailId = useId();
  const pwId = useId();

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.formError} />
      <Field id={emailId} label="이메일" error={state?.fieldErrors?.email}>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.values?.email}
          placeholder="you@example.com"
          aria-invalid={!!state?.fieldErrors?.email}
          aria-describedby={state?.fieldErrors?.email ? `${emailId}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <Field id={pwId} label="비밀번호" error={state?.fieldErrors?.password}>
        <input
          id={pwId}
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!state?.fieldErrors?.password}
          aria-describedby={state?.fieldErrors?.password ? `${pwId}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <SubmitButton pending={pending} label="로그인" pendingLabel="로그인 중…" />
    </form>
  );
}

function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  const nickId = useId();
  const emailId = useId();
  const pwId = useId();

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.formError} />
      <Field id={nickId} label="닉네임" error={state?.fieldErrors?.nickname}>
        <input
          id={nickId}
          name="nickname"
          type="text"
          autoComplete="nickname"
          maxLength={20}
          defaultValue={state?.values?.nickname}
          placeholder="2~20자"
          aria-invalid={!!state?.fieldErrors?.nickname}
          aria-describedby={state?.fieldErrors?.nickname ? `${nickId}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <Field id={emailId} label="이메일" error={state?.fieldErrors?.email}>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.values?.email}
          placeholder="you@example.com"
          aria-invalid={!!state?.fieldErrors?.email}
          aria-describedby={state?.fieldErrors?.email ? `${emailId}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <Field id={pwId} label="비밀번호" error={state?.fieldErrors?.password}>
        <input
          id={pwId}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="6자 이상"
          aria-invalid={!!state?.fieldErrors?.password}
          aria-describedby={state?.fieldErrors?.password ? `${pwId}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <SubmitButton pending={pending} label="가입하고 시작하기" pendingLabel="가입 중…" />
    </form>
  );
}
