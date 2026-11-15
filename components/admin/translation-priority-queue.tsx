"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  claimTranslationPriority,
  type TranslationPriorityQueueRow,
} from "@/lib/actions/admin-translations";
import { LANGUAGE_NAMES } from "@/lib/i18n";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function PriorityRow({ row }: { row: TranslationPriorityQueueRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const missingTranslation = row.translationStatus === null;

  function openReview() {
    setMessage(null);
    startTransition(async () => {
      const result = await claimTranslationPriority({ memeId: row.memeId, locale: row.locale });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.push(
        missingTranslation
          ? `/admin/translations?locale=${row.locale}&focus=${row.memeId}`
          : `/admin/memes/${row.memeId}`,
      );
    });
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4" data-translation-priority-row>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">
            <span>{LANGUAGE_NAMES[row.locale]}</span>
            <span className="rounded-full bg-accent-soft px-2 py-1 text-accent-text">
              Plus {row.requestCount}건 요청
            </span>
            {row.routeUnlockCandidate && (
              <span className="rounded-full bg-safety-yellow-bg px-2 py-1 text-safety-yellow">
                라우트 해금 후보
              </span>
            )}
            <span className="rounded-full bg-surface-2 px-2 py-1">
              {row.status === "in_review" ? "검수 중" : "대기"}
            </span>
          </div>
          <h3 className="mt-2 text-base font-bold">{row.memeTitle}</h3>
          <p className="mt-1 text-xs text-muted">
            최근 요청 {formatDate(row.latestRequestedAt)} · {row.memeShortId}
          </p>
        </div>
        {missingTranslation ? (
          <button
            type="button"
            onClick={openReview}
            disabled={pending}
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-accent-strong px-3 text-sm font-bold text-white"
          >
            {pending ? "여는 중…" : "초안 만들기"}
          </button>
        ) : (
          <button
            type="button"
            onClick={openReview}
            disabled={pending}
            className="min-h-11 shrink-0 rounded-xl bg-accent-strong px-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "여는 중…" : "검수 열기"}
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-sm font-semibold text-safety-red" role="alert">{message}</p>}
      <Link
        href={`/admin/memes/${row.memeId}`}
        className="mt-2 inline-flex text-xs font-semibold text-accent-text underline underline-offset-4"
      >
        밈 편집 페이지 보기
      </Link>
    </li>
  );
}

export function TranslationPriorityQueue({
  rows,
  error = null,
}: {
  rows: TranslationPriorityQueueRow[];
  error?: string | null;
}) {
  return (
    <section
      aria-labelledby="translation-priority-queue-title"
      className="rounded-2xl border border-accent/30 bg-accent-soft/15 p-5"
      data-translation-priority-queue
    >
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">PLUS TRANSLATION DESK</p>
        <h2 id="translation-priority-queue-title" className="mt-1 text-xl font-bold">Plus 번역 수요 큐</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">요청 수가 많은 밈부터 검수하고, 승인하면 요청자에게 완료 신호를 보냅니다.</p>
      </div>
      {error ? (
        <p className="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red" role="alert">
          번역 수요 큐를 불러오지 못했어요. 0건으로 간주하지 않았습니다. 잠시 후 다시 확인해 주세요.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm text-muted">현재 대기 중인 Plus 번역 요청이 없어요.</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {rows.map((row) => <PriorityRow key={`${row.memeId}:${row.locale}`} row={row} />)}
        </ol>
      )}
    </section>
  );
}
