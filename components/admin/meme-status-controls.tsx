"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionMemeStatus } from "@/lib/actions/admin";
import { MODERATION_STATUS } from "@/lib/labels";
import { isHouseOriginal } from "@/lib/house-original";
import {
  LIMITED_WARNING,
  TRANSITION_ACTION_LABELS,
  VALID_TRANSITIONS,
  type ModerationStatus,
} from "./constants";

/** 유효한 전이만 버튼으로 노출. limited 전환은 주의 문구 확인, approved→limited는 노출 중단 원클릭 */
export function MemeStatusControls({
  memeId,
  currentStatus,
  originKind = "catalog",
}: {
  memeId: string;
  currentStatus: ModerationStatus;
  originKind?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmLimited, setConfirmLimited] = useState(false);
  const [attested, setAttested] = useState(false);
  const houseOriginal = isHouseOriginal(originKind);

  const targets = VALID_TRANSITIONS[currentStatus];
  const needsAttestation =
    houseOriginal && targets.some((to) => to === "approved" || to === "limited");

  function run(to: ModerationStatus) {
    setError(null);
    startTransition(async () => {
      const publishing = to === "approved" || to === "limited";
      if (houseOriginal && publishing && !attested) {
        setError("자체 제작 권리 확인에 동의해 주세요.");
        return;
      }
      const res = await transitionMemeStatus({
        memeId,
        to,
        attested: houseOriginal && publishing ? true : undefined,
      });
      if (!res.ok) setError(res.error);
      else {
        setConfirmLimited(false);
        router.refresh();
      }
    });
  }

  if (targets.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-2 p-4 text-base text-muted">
        {MODERATION_STATUS[currentStatus].admin} 상태에서는 더 이상 전이할 수 없어요.
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">검수 상태 전이</h2>
      {error && (
        <p role="alert" className="rounded-lg bg-safety-red-bg p-3 text-base text-safety-red">
          {error}
        </p>
      )}
      {needsAttestation && (
        <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-base">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-1 size-4"
          />
          <span>
            이 항목은 밈캐치가 만들고 권리를 보유한 자체 제작이며, 제3자 초상·음원·로고를
            포함하지 않음을 확인합니다.
          </span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {targets.map((to) => {
          if (to === "limited") {
            return (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => setConfirmLimited(true)}
                className="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-base font-semibold text-safety-yellow disabled:opacity-50"
              >
                {currentStatus === "approved" ? "노출 중단 (제한 공개)" : TRANSITION_ACTION_LABELS.limited}
              </button>
            );
          }
          const danger = to === "rejected";
          return (
            <button
              key={to}
              type="button"
              disabled={pending}
              onClick={() => run(to)}
              className={`min-h-11 rounded-lg px-4 text-base font-semibold disabled:opacity-50 ${
                danger
                  ? "border border-safety-red bg-safety-red-bg text-safety-red"
                  : to === "approved"
                    ? "bg-accent-strong text-white"
                    : "border border-border bg-surface-2"
              }`}
            >
              {TRANSITION_ACTION_LABELS[to]}
            </button>
          );
        })}
      </div>

      {confirmLimited && (
        <div className="rounded-lg border border-safety-yellow bg-safety-yellow-bg p-4">
          <p className="text-base text-foreground">
            <span aria-hidden className="mr-1 text-safety-yellow">▲</span>
            {LIMITED_WARNING}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run("limited")}
              className="min-h-11 rounded-lg bg-safety-yellow px-4 text-base font-semibold text-background disabled:opacity-50"
            >
              {pending ? "전환 중…" : "제한 공개로 전환"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmLimited(false)}
              className="min-h-11 rounded-lg border border-border bg-surface px-4 text-base"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
