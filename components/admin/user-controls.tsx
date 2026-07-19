"use client";

import { useState, useTransition } from "react";
import {
  sendPasswordReset,
  setUserPassword,
  setUserRole,
} from "@/lib/actions/admin-users";
import { setUserPlus } from "@/lib/actions/admin";

/**
 * 사용자 상세의 변경 컨트롤 — 비밀번호(직접 설정/재설정 메일), 권한, Plus 구독.
 * 모든 액션은 서버에서 operator를 재확인하고 감사 로그를 남긴다.
 */
export function UserControls({
  userId,
  email,
  role,
  isPremium,
}: {
  userId: string;
  email: string | null;
  role: string | null;
  isPremium: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [months, setMonths] = useState(1);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(
        res.ok
          ? { ok: true, text: okText }
          : { ok: false, text: res.error ?? "실패했어요." }
      );
      if (res.ok) setPw("");
    });
  }

  const btn =
    "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition-transform active:scale-[0.97] disabled:opacity-60";
  const primary = `${btn} bg-accent-strong text-white`;
  const ghost = `${btn} border border-border bg-surface font-semibold`;
  const input =
    "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";

  return (
    <div className="space-y-6">
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            msg.ok
              ? "bg-safety-green-bg text-safety-green"
              : "bg-safety-red-bg text-safety-red"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* 비밀번호 */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">비밀번호</h2>
        <p className="mt-1 text-sm text-muted">
          재설정 메일을 보내면 사용자가 직접 정합니다(권장). 직접 설정하면 즉시
          적용돼요.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="새 비밀번호 (8자 이상)"
            autoComplete="new-password"
            className={input}
          />
          <button
            type="button"
            disabled={pending || pw.length < 8}
            onClick={() =>
              run(
                () => setUserPassword({ userId, password: pw }),
                "비밀번호를 변경했어요."
              )
            }
            className={`${primary} shrink-0`}
          >
            직접 설정
          </button>
        </div>
        <button
          type="button"
          disabled={pending || !email}
          onClick={() =>
            run(
              () => sendPasswordReset(email as string),
              "재설정 메일을 보냈어요."
            )
          }
          className={`${ghost} mt-3 w-full sm:w-auto`}
        >
          재설정 메일 보내기
        </button>
      </section>

      {/* Plus 구독 */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">Plus 구독</h2>
        <p className="mt-1 text-sm text-muted">
          수동 부여는 결제와 분리된 무료 권한이에요(감사 로그 기록).
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="plus-months-detail"
              className="block text-xs font-semibold text-muted"
            >
              기간(개월)
            </label>
            <input
              id="plus-months-detail"
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={(e) =>
                setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))
              }
              className="mt-1 h-11 w-20 rounded-xl border border-border bg-surface px-3 text-base tabular-nums outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"
            />
          </div>
          <button
            type="button"
            disabled={pending || !email}
            onClick={() =>
              run(
                () =>
                  setUserPlus({ email: email as string, active: true, months }),
                `Plus를 ${months}개월 부여했어요.`
              )
            }
            className={primary}
          >
            {isPremium ? "기간 연장·재부여" : "Plus 부여"}
          </button>
          {isPremium && (
            <button
              type="button"
              disabled={pending || !email}
              onClick={() =>
                run(
                  () =>
                    setUserPlus({ email: email as string, active: false }),
                  "Plus를 해제했어요."
                )
              }
              className={`${ghost} text-safety-red`}
            >
              Plus 해제
            </button>
          )}
        </div>
      </section>

      {/* 권한 */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">권한</h2>
        <p className="mt-1 text-sm text-muted">
          운영자는 관리자 콘솔 전체에 접근할 수 있어요. 신중히 부여하세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {role === "operator" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => setUserRole({ userId, role: "user" }),
                  "일반 사용자로 변경했어요."
                )
              }
              className={`${ghost} text-safety-red`}
            >
              운영자 권한 해제
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => setUserRole({ userId, role: "operator" }),
                  "운영자로 지정했어요."
                )
              }
              className={primary}
            >
              운영자로 지정
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
