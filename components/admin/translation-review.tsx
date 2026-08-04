"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteMemeTranslation,
  rejectMemeTranslationDraft,
  reviewMemeTranslation,
  type TranslationQueueRow,
} from "@/lib/actions/admin-translations";
import { LANGUAGE_NAMES } from "@/lib/i18n";

/**
 * 번역 검수 큐 카드 — 원문(한국어)과 번역을 나란히 보여주고 승인/반려/삭제한다.
 * 실제 저장·발행 CAS 로직은 lib/actions/admin-translations.ts의 기존
 * reviewMemeTranslation을 그대로 재사용한다(밈 상세 페이지와 동일 규칙).
 */

const STATUS_COPY = {
  machine: { label: "검수 전", className: "bg-surface-2 text-muted" },
  reviewed: { label: "검수 완료·발행", className: "bg-safety-green-bg text-safety-green" },
  stale: { label: "원문 변경·갱신 필요", className: "bg-safety-yellow-bg text-safety-yellow" },
} as const;

function sameInstant(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

const TRANSLATION_FIELDS = [
  ["description", "설명", 6],
  ["origin", "유래", 5],
  ["usageNote", "사용법", 4],
  ["caution", "주의사항", 4],
] as const;

function TranslationQueueCard({ row }: { row: TranslationQueueRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState({
    title: row.title,
    summary: row.summary,
    description: row.description,
    origin: row.origin,
    usageNote: row.usageNote ?? "",
    caution: row.caution ?? "",
  });

  const fresh = sameInstant(row.sourceUpdatedAt, row.memeUpdatedAt);
  const statusCopy = STATUS_COPY[row.status];
  const prefix = `[${row.memeShortId}/${row.locale}]`;

  function set<K extends keyof typeof form>(field: K, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage({ ok: false, text: result.error ?? "처리하지 못했어요." });
        return;
      }
      setMessage({ ok: true, text: successMessage });
      onSuccess?.();
      router.refresh();
    });
  }

  function onApprove() {
    run(
      () =>
        reviewMemeTranslation({
          memeId: row.memeId,
          locale: row.locale,
          expectedTranslationUpdatedAt: row.updatedAt,
          title: form.title,
          summary: form.summary,
          description: form.description,
          origin: form.origin,
          usageNote: form.usageNote,
          caution: form.caution,
          aliases: row.aliases,
        }),
      `${LANGUAGE_NAMES[row.locale]} 번역을 승인하고 발행했어요.`,
    );
  }

  function onReject() {
    if (!reason.trim()) {
      setMessage({ ok: false, text: "반려 사유를 입력해 주세요." });
      return;
    }
    run(
      () =>
        rejectMemeTranslationDraft({
          memeId: row.memeId,
          locale: row.locale,
          expectedTranslationUpdatedAt: row.updatedAt,
          reason,
        }),
      "반려 사유를 감사 로그에 기록했어요.",
      () => setReason(""),
    );
  }

  function onDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    run(
      () =>
        deleteMemeTranslation({
          memeId: row.memeId,
          locale: row.locale,
          expectedTranslationUpdatedAt: row.updatedAt,
        }),
      `${LANGUAGE_NAMES[row.locale]} 번역을 삭제했어요.`,
    );
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";
  const readonlyClass =
    "mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-muted";

  return (
    <article className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/memes/${row.memeId}`}
              className="text-lg font-semibold text-accent-text hover:underline"
            >
              {row.memeTitle}
            </Link>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">
              {LANGUAGE_NAMES[row.locale]} ({row.locale})
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCopy.className}`}>
              {statusCopy.label}
            </span>
            {!fresh && (
              <span className="rounded-full bg-safety-red-bg px-2.5 py-1 text-xs font-semibold text-safety-red">
                stale — 원문 revision 불일치
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            번역 갱신 {formatDate(row.updatedAt)} · 마지막 검수 {formatDate(row.reviewedAt)}
          </p>
        </div>
      </div>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
            message.ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-bold text-muted">원문 (한국어)</h4>
          <label className="mt-2 block text-sm font-medium">
            제목
            <input readOnly value={row.memeTitle} className={readonlyClass} />
          </label>
          <label className="mt-2 block text-sm font-medium">
            한 줄 요약
            <textarea readOnly value={row.memeSummary} rows={2} className={readonlyClass} />
          </label>
          <label className="mt-2 block text-sm font-medium">
            설명
            <textarea readOnly value={row.memeDescription} rows={6} className={readonlyClass} />
          </label>
          <label className="mt-2 block text-sm font-medium">
            유래
            <textarea readOnly value={row.memeOrigin} rows={5} className={readonlyClass} />
          </label>
          <label className="mt-2 block text-sm font-medium">
            사용법
            <textarea readOnly value={row.memeUsageNote ?? ""} rows={4} className={readonlyClass} />
          </label>
          <label className="mt-2 block text-sm font-medium">
            주의사항
            <textarea readOnly value={row.memeCaution ?? ""} rows={4} className={readonlyClass} />
          </label>
        </div>

        <div>
          <h4 className="text-sm font-bold text-muted">번역 ({LANGUAGE_NAMES[row.locale]})</h4>
          <label className="mt-2 block text-sm font-medium">
            제목
            <input
              aria-label={`${prefix} 제목`}
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="mt-2 block text-sm font-medium">
            한 줄 요약
            <textarea
              aria-label={`${prefix} 한 줄 요약`}
              value={form.summary}
              onChange={(event) => set("summary", event.target.value)}
              rows={2}
              className={inputClass}
            />
          </label>
          {TRANSLATION_FIELDS.map(([field, label, rows]) => (
            <label key={field} className="mt-2 block text-sm font-medium">
              {label}
              <textarea
                aria-label={`${prefix} ${label}`}
                value={form[field]}
                onChange={(event) => set(field, event.target.value)}
                rows={rows}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </div>

      {!fresh && (
        <p className="rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm text-safety-yellow">
          한국어 원문이 번역 이후 변경됐습니다. 새 원문 기준 번역을 생성하기 전에는 승인·발행할
          수 없습니다.
        </p>
      )}

      <label className="block text-sm font-medium">
        반려 사유 (반려 시 필수 — 감사 로그에 기록돼요)
        <textarea
          aria-label={`${prefix} 반려 사유`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="예: 고유명사 표기가 부정확해요"
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          disabled={pending || !fresh}
          onClick={onApprove}
          className="min-h-11 rounded-lg bg-safety-green px-4 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "처리 중…" : "승인·발행"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReject}
          className="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-sm font-semibold text-safety-yellow disabled:opacity-50"
        >
          반려
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className={`min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50 ${
            confirmingDelete
              ? "border-safety-red bg-safety-red-bg text-safety-red"
              : "border-border bg-surface-2 text-muted"
          }`}
        >
          {confirmingDelete ? "정말 삭제할까요? 다시 클릭" : "삭제"}
        </button>
      </div>
    </article>
  );
}

export function TranslationReviewQueue({ rows }: { rows: TranslationQueueRow[] }) {
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <TranslationQueueCard key={`${row.memeId}:${row.locale}`} row={row} />
      ))}
    </div>
  );
}
