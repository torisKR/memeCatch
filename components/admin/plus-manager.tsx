"use client";

import { useState, useTransition } from "react";
import {
  lookupPlusStatus,
  setUserPlus,
  type PlusStatusView,
} from "@/lib/actions/admin";

/**
 * 운영자 Plus 관리 — 이메일로 상태 조회 + 수동 부여(시한부)/해제.
 * 부여/해제는 admin_audit_log에 기록되며, 실결제와 분리된 manual 구독으로 관리된다.
 */

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlusManager() {
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(1);
  const [status, setStatus] = useState<PlusStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    setNotice(null);
    startTransition(fn);
  }

  function onLookup() {
    run(async () => {
      const res = await lookupPlusStatus(email);
      if (!res.ok) {
        setStatus(null);
        setError(res.error);
        return;
      }
      setStatus(res.data ?? null);
    });
  }

  function onSet(active: boolean) {
    run(async () => {
      const res = await setUserPlus({ email, active, months });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus(res.data ?? null);
      setNotice(
        active
          ? `Plus를 ${months}개월 부여했어요.`
          : "Plus를 해제했어요."
      );
    });
  }

  const premium = status?.isPremium === true;

  return (
    <div className="mt-6 space-y-5">
      {/* 조회 폼 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onLookup();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="plus-email" className="sr-only">
          사용자 이메일
        </label>
        <input
          id="plus-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="사용자 이메일 (결제·로그인 이메일)"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
        >
          {pending ? "확인 중…" : "상태 조회"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold text-safety-red"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-safety-green-bg px-4 py-3 text-sm font-semibold text-safety-green"
        >
          {notice}
        </p>
      )}

      {/* 상태 카드 */}
      {status && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          {!status.userFound ? (
            <p className="text-base font-semibold">
              가입 계정을 찾을 수 없어요.
              <span className="mt-1 block text-sm font-normal text-muted">
                이 이메일로 로그인·가입한 사용자가 없어요. 결제 이메일과 밈캐치
                로그인 이메일이 같은지 확인해 주세요.
              </span>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{status.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {status.userId}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
                    premium
                      ? "bg-safety-green-bg text-safety-green"
                      : "bg-safety-gray-bg text-safety-gray"
                  }`}
                >
                  <span aria-hidden>{premium ? "●" : "○"}</span>
                  {premium ? "Plus 활성" : "무료"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-muted">구독 상태</dt>
                <dd className="text-right font-semibold">
                  {status.status ?? "구독 없음"}
                </dd>
                <dt className="text-muted">유효 기간</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {fmtDate(status.currentPeriodEnd)}
                </dd>
                <dt className="text-muted">부여 방식</dt>
                <dd className="text-right font-semibold">
                  {status.status == null
                    ? "—"
                    : status.isManual
                      ? "수동 부여"
                      : "결제"}
                </dd>
                <dt className="text-muted">결제 이메일 연결</dt>
                <dd className="text-right font-semibold">
                  {status.hasBillingIdentity ? "연결됨" : "미연결"}
                </dd>
              </dl>

              {/* 부여/해제 컨트롤 */}
              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                <div className="flex items-end gap-2">
                  <div>
                    <label
                      htmlFor="plus-months"
                      className="block text-xs font-semibold text-muted"
                    >
                      부여 기간(개월)
                    </label>
                    <input
                      id="plus-months"
                      type="number"
                      min={1}
                      max={36}
                      value={months}
                      onChange={(e) =>
                        setMonths(
                          Math.max(1, Math.min(36, Number(e.target.value) || 1))
                        )
                      }
                      className="mt-1 h-11 w-20 rounded-xl border border-border bg-surface px-3 text-base tabular-nums outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onSet(true)}
                    className="inline-flex h-11 items-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                  >
                    {premium ? "기간 연장·재부여" : "Plus 부여"}
                  </button>
                </div>
                {premium && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onSet(false)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 text-base font-semibold text-safety-red transition-colors hover:border-safety-red disabled:opacity-60 sm:ml-auto"
                  >
                    Plus 해제
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                수동 부여는 실결제와 분리된 무료 권한이에요. 부여·해제 기록은 감사
                로그에 남아요. 결제로 가입한 구독은 여기서 해제해도 다음 결제
                이벤트에 다시 반영될 수 있어요.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
