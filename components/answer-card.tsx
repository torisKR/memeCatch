"use client";

import type { ReactNode } from "react";
import { DocClassNote } from "@/components/doc-class-note";
import { SaveButton } from "@/components/save-button";
import { SafetyIcon } from "@/components/safety-icon";
import {
  LIFECYCLE_STATUS,
  SAFETY_LEVELS,
  type SafetyLevel,
} from "@/lib/labels";
import type { MemeRow } from "@/lib/queries";

const SAFETY_TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

/**
 * 정답 카드 — 상세 최상단에서 밈명과 한 줄 뜻을 먼저 답한다.
 * 생애주기와 안전 신호는 실제 상태 문구만 작게 유지해 빠르게 훑을 수 있게 한다.
 */
export function AnswerCard({
  meme,
  saveMemeId,
  actions,
}: {
  meme: Pick<
    MemeRow,
    "title" | "summary" | "lifecycle_status" | "safety_level"
  > & {
    /** 상세 조회(select("*"))에서만 실려 온다 — 목록·위젯 select에는 없어 optional. */
    doc_class?: MemeRow["doc_class"];
    usage_note?: MemeRow["usage_note"];
  };
  saveMemeId?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label="정답 카드"
      className="rounded-3xl border border-accent/25 border-l-4 border-l-accent bg-accent-soft/30 px-5 py-6 sm:px-7 sm:py-7"
    >
      <p className="text-xs font-extrabold tracking-[0.08em] text-accent-text">
        한눈에 보는 뜻
      </p>
      <h1 className="mt-2 max-w-[22ch] text-balance break-words text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
        {meme.title}
      </h1>
      <p
        id="meme-summary"
        className="mt-3 max-w-[65ch] text-base leading-7 text-foreground sm:text-lg"
      >
        {meme.summary}
      </p>
      <DocClassNote docClass={meme.doc_class} />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <dl className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <dt className="text-xs font-semibold text-muted">밈의 흐름</dt>
            <dd className="inline-flex min-h-8 items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-semibold text-foreground">
              {LIFECYCLE_STATUS[meme.lifecycle_status].user}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs font-semibold text-muted">사용 신호</dt>
            <dd
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${SAFETY_TONE[meme.safety_level]}`}
            >
              <SafetyIcon level={meme.safety_level} className="size-4" />
              {SAFETY_LEVELS[meme.safety_level].user}
            </dd>
          </div>
        </dl>
        {(saveMemeId || actions) && (
          <div data-answer-actions className="flex items-center gap-2">
            {saveMemeId && <SaveButton memeId={saveMemeId} compact />}
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
