"use client";

import { useActionState, useId, useState } from "react";
import { BrandTile } from "@/components/brand-mark";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

/**
 * 레인 C — 로그인/가입 폼(클라이언트). DESIGN.md §10 인증.
 * - 로그인/가입 탭 전환(motion 인디케이터 + AnimatePresence 크로스페이드).
 * - 상단 소셜 버튼(카카오=노란 브랜드색, 구글=흰 버튼 테두리) → signInWithOAuth.
 *   provider 미설정 시 에러 캐치 → "곧 열려요" 우아한 폴백(role=status).
 * - 이메일/비밀번호는 서버액션(signIn/signUp) + useActionState.
 * - next 쿼리 보존, 해요체, 불꽃 오렌지 톤, 접근성 폼(label·인라인 에러·autocomplete).
 */

type Mode = "login" | "signup";
type Provider = "kakao" | "google";

const PROVIDER_LABEL: Record<Provider, string> = {
  kakao: "카카오",
  google: "구글",
};

export function LoginForm({
  next,
  callbackError = false,
  initialMode = "login",
}: {
  next: string;
  callbackError?: boolean;
  initialMode?: Mode;
}) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  async function startOAuth(provider: Provider) {
    if (oauthBusy) return;
    setOauthBusy(provider);
    setOauthNotice(null);
    const label = PROVIDER_LABEL[provider];
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      // 성공 시 Supabase가 브라우저를 자동으로 리다이렉트한다.
      if (error) {
        setOauthBusy(null);
        setOauthNotice(
          `${label} 로그인은 곧 열려요. 지금은 이메일로 시작해 주세요.`
        );
      }
    } catch {
      setOauthBusy(null);
      setOauthNotice(
        `${label} 로그인은 곧 열려요. 지금은 이메일로 시작해 주세요.`
      );
    }
  }

  const enter: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        },
      };

  return (
    <motion.div variants={enter} initial="hidden" animate="show">
      <div className="flex items-center gap-2">
        <BrandTile className="size-9" />
        <span className="text-lg font-extrabold tracking-tight">밈캐치</span>
      </div>

      <h1 className="mt-6 text-[1.75rem] font-extrabold leading-tight">
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

      {/* 소셜 로그인 */}
      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => startOAuth("kakao")}
          disabled={!!oauthBusy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 text-base font-semibold text-[#191600] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {oauthBusy === "kakao" ? (
            <Spinner className="border-[#191600]/30 border-t-[#191600]" />
          ) : (
            <KakaoMark className="h-5 w-5" />
          )}
          카카오로 시작하기
        </button>
        <button
          type="button"
          onClick={() => startOAuth("google")}
          disabled={!!oauthBusy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-base font-semibold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {oauthBusy === "google" ? (
            <Spinner className="border-muted/30 border-t-muted" />
          ) : (
            <GoogleMark className="h-5 w-5" />
          )}
          구글로 시작하기
        </button>
        <a
          href={`/auth/tiktok?next=${encodeURIComponent(next)}`}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 text-base font-semibold text-white transition-transform active:scale-[0.98]"
        >
          <TikTokMark className="h-5 w-5" />
          TikTok으로 시작하기
        </a>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {oauthNotice}
      </p>

      {/* 구분선 */}
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted">또는 이메일로</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* 로그인/가입 탭 */}
      <div
        role="tablist"
        aria-label="로그인 방법 선택"
        className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1"
      >
        {(
          [
            ["login", "로그인"],
            ["signup", "가입하기"],
          ] as const
        ).map(([key, label]) => {
          const selected = mode === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMode(key)}
              className={`relative min-h-11 rounded-lg text-base font-semibold transition-colors ${
                selected ? "text-foreground" : "text-muted"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="login-tab-pill"
                  className="absolute inset-0 rounded-lg bg-surface shadow-sm"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 400, damping: 32 }
                  }
                />
              )}
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {mode === "login" ? (
              <SignInForm next={next} />
            ) : (
              <SignUpForm next={next} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-8 text-center text-muted">
        <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground">
          로그인 없이 둘러보기
        </Link>
      </p>
    </motion.div>
  );
}

function TikTokMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M14.4 3.2c.5 2.5 1.9 4 4.4 4.5v3.1a8.6 8.6 0 0 1-4.4-1.4v6.1a5.8 5.8 0 1 1-5-5.7v3.2a2.7 2.7 0 1 0 1.8 2.5V3.2h3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── 폼 ─────────────────────────────────────── */

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20";

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

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red">
      {message}
    </p>
  );
}

function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {pending && <Spinner className="border-white/40 border-t-white" />}
      {pending ? pendingLabel : label}
    </button>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signIn,
    null
  );
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
          inputMode="email"
          defaultValue={state?.values?.email}
          placeholder="you@example.com"
          aria-invalid={!!state?.fieldErrors?.email}
          aria-describedby={
            state?.fieldErrors?.email ? `${emailId}-error` : undefined
          }
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
          aria-describedby={
            state?.fieldErrors?.password ? `${pwId}-error` : undefined
          }
          className={inputClass}
        />
      </Field>
      <SubmitButton pending={pending} label="로그인" pendingLabel="로그인 중…" />
      <Link
        href="/forgot-password"
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-accent-text transition-colors hover:text-accent"
      >
        비밀번호를 잊으셨나요?
      </Link>
    </form>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signUp,
    null
  );
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
          placeholder="2~20자로 지어 주세요"
          aria-invalid={!!state?.fieldErrors?.nickname}
          aria-describedby={
            state?.fieldErrors?.nickname ? `${nickId}-error` : undefined
          }
          className={inputClass}
        />
      </Field>
      <Field id={emailId} label="이메일" error={state?.fieldErrors?.email}>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state?.values?.email}
          placeholder="you@example.com"
          aria-invalid={!!state?.fieldErrors?.email}
          aria-describedby={
            state?.fieldErrors?.email ? `${emailId}-error` : undefined
          }
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
          aria-describedby={
            state?.fieldErrors?.password ? `${pwId}-error` : undefined
          }
          className={inputClass}
        />
      </Field>
      <SubmitButton
        pending={pending}
        label="가입하고 시작하기"
        pendingLabel="가입 중…"
      />
    </form>
  );
}

/* ── 아이콘 ─────────────────────────────────── */

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`h-4 w-4 animate-spin rounded-full border-2 ${className}`}
    />
  );
}


function KakaoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#191600" aria-hidden>
      <path d="M12 3.5c-4.97 0-9 3.14-9 7.02 0 2.5 1.68 4.69 4.2 5.94-.14.5-.9 3.1-.93 3.31 0 0-.02.15.08.21.1.06.22.01.22.01.28-.04 3.24-2.13 3.76-2.5.53.08 1.09.12 1.67.12 4.97 0 9-3.14 9-7.1 0-3.87-4.03-7.01-9-7.01Z" />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.68-.06-1.34-.17-1.97H12v3.73h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.28Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.42 13.9a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96l3.36-2.58Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.52l3.36 2.58C7.2 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}
