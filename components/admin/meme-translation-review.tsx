"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markMemeTranslationStale,
  reviewMemeTranslation,
  reviewMemeTranslationWithGpt,
  saveMemeTranslation,
} from "@/lib/actions/admin-translations";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import type { SeoContentLocale } from "@/lib/i18n-routing";

const AI_RECOMMENDATION_COPY = {
  approve: "발행 가능",
  edit: "교정 후 발행",
  reject: "발행 보류",
} as const;

export type MemeTranslationReviewRow = {
  locale: SeoContentLocale;
  status: "machine" | "reviewed" | "stale";
  source_updated_at: string;
  translated_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  aliases: string[];
};

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

function TranslationEditor({
  memeId,
  memeUpdatedAt,
  translation,
  hasOpenAiReviewKey,
}: {
  memeId: string;
  memeUpdatedAt: string;
  translation: MemeTranslationReviewRow;
  hasOpenAiReviewKey: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [form, setForm] = useState({
    title: translation.title,
    summary: translation.summary,
    description: translation.description,
    origin: translation.origin,
    usageNote: translation.usage_note ?? "",
    caution: translation.caution ?? "",
    aliases: translation.aliases.join(", "),
  });
  const fresh = sameInstant(translation.source_updated_at, memeUpdatedAt);
  const statusCopy = STATUS_COPY[translation.status];
  const prefix = `[${translation.locale}]`;
  const busy = pending || aiReviewing;

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function actionInput() {
    return {
      memeId,
      locale: translation.locale,
      expectedTranslationUpdatedAt: translation.updated_at,
      title: form.title,
      summary: form.summary,
      description: form.description,
      origin: form.origin,
      usageNote: form.usageNote,
      caution: form.caution,
      aliases: form.aliases
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
    };
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage({ ok: false, text: result.error ?? "처리하지 못했어요." });
        return;
      }
      setMessage({ ok: true, text: successMessage });
      router.refresh();
    });
  }

  async function onAiReview() {
    setMessage(null);
    setAiReviewing(true);
    try {
      const result = await reviewMemeTranslationWithGpt({
        memeId,
        locale: translation.locale,
        expectedTranslationUpdatedAt: translation.updated_at,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      const draft = result.data;
      setForm((current) => ({
        ...current,
        title: draft.title,
        summary: draft.summary,
        description: draft.description,
        origin: draft.origin,
        usageNote: draft.usage_note,
        caution: draft.caution,
        aliases: draft.aliases.join(", "),
      }));
      const notes = draft.review_notes.slice(0, 2).join(" · ");
      setMessage({
        ok: true,
        text: `GPT 검수 의견: ${AI_RECOMMENDATION_COPY[draft.recommendation]} · 신뢰도 ${draft.confidence}${notes ? ` · ${notes}` : ""}`,
      });
    } finally {
      setAiReviewing(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";

  return (
    <article className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">
              {LANGUAGE_NAMES[translation.locale]} ({translation.locale})
            </h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCopy.className}`}>
              {statusCopy.label}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                fresh
                  ? "bg-safety-green-bg text-safety-green"
                  : "bg-safety-red-bg text-safety-red"
              }`}
            >
              {fresh ? "원문과 동일 revision" : "stale — 원문 revision 불일치"}
            </span>
          </div>
          <dl className="mt-2 grid gap-x-5 gap-y-1 text-xs text-muted sm:grid-cols-2">
            <div>
              <dt className="inline font-semibold">원문 수정</dt>{" "}
              <dd className="inline">{formatDate(memeUpdatedAt)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">번역 기준 원문</dt>{" "}
              <dd className="inline">{formatDate(translation.source_updated_at)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">번역 생성</dt>{" "}
              <dd className="inline">{formatDate(translation.translated_at)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">마지막 검수</dt>{" "}
              <dd className="inline">
                {formatDate(translation.reviewed_at)}
                {translation.reviewed_by ? ` · ${translation.reviewed_by}` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
            message.ok
              ? "bg-safety-green-bg text-safety-green"
              : "bg-safety-red-bg text-safety-red"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium">
          제목
          <input
            aria-label={`${prefix} 제목`}
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          별칭 (쉼표로 구분)
          <input
            aria-label={`${prefix} 별칭`}
            value={form.aliases}
            onChange={(event) => set("aliases", event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block text-sm font-medium">
        한 줄 요약
        <textarea
          aria-label={`${prefix} 한 줄 요약`}
          value={form.summary}
          onChange={(event) => set("summary", event.target.value)}
          required
          rows={2}
          className={inputClass}
        />
      </label>

      {(
        [
          ["description", "설명", 6],
          ["origin", "유래", 5],
          ["usageNote", "사용법", 4],
          ["caution", "주의사항", 4],
        ] as const
      ).map(([field, label, rows]) => (
        <label key={field} className="block text-sm font-medium">
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

      {!fresh && (
        <p className="rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm text-safety-yellow">
          한국어 원문이 번역 이후 변경됐습니다. 새 원문 기준 번역을 생성하기 전에는 검수
          발행할 수 없습니다.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <span title={hasOpenAiReviewKey ? undefined : "OPENAI_API_KEY 설정 필요"}>
          <button
            type="button"
            disabled={busy || !hasOpenAiReviewKey}
            onClick={onAiReview}
            className="min-h-11 rounded-lg border border-accent bg-accent/10 px-4 text-sm font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            {aiReviewing ? "GPT 검수 중…" : "GPT-5.6 Sol high 검수"}
          </button>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              () => saveMemeTranslation(actionInput()),
              `${LANGUAGE_NAMES[translation.locale]} 번역을 저장했어요. 다시 검수해 주세요.`,
            )
          }
          className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "처리 중…" : `${prefix} 초안 저장`}
        </button>
        <button
          type="button"
          disabled={busy || !fresh}
          onClick={() =>
            run(
              () => reviewMemeTranslation(actionInput()),
              `${LANGUAGE_NAMES[translation.locale]} 번역을 검수 완료하고 발행했어요.`,
            )
          }
          className="min-h-11 rounded-lg bg-safety-green px-4 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {prefix} 검수 완료·발행
        </button>
        <button
          type="button"
          disabled={busy || translation.status === "stale"}
          onClick={() =>
            run(
              () =>
                markMemeTranslationStale({
                  memeId,
                  locale: translation.locale,
                  expectedTranslationUpdatedAt: translation.updated_at,
                }),
              `${LANGUAGE_NAMES[translation.locale]} 번역을 stale로 표시했어요.`,
            )
          }
          className="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-sm font-semibold text-safety-yellow disabled:opacity-40"
        >
          {prefix} stale로 되돌리기
        </button>
      </div>
    </article>
  );
}

export function MemeTranslationReview({
  memeId,
  memeUpdatedAt,
  translations,
  hasOpenAiReviewKey = false,
}: {
  memeId: string;
  memeUpdatedAt: string;
  translations: MemeTranslationReviewRow[];
  hasOpenAiReviewKey?: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="meme-translation-review-title">
      <div>
        <h2 id="meme-translation-review-title" className="text-xl font-bold">
          다국어 번역 검수
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          원문과 같은 revision의 번역만 검수 발행할 수 있습니다. 편집 저장 후에는 반드시 다시
          검수해야 합니다.
        </p>
      </div>
      {translations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          생성된 번역 초안이 없습니다. 오프라인 번역 배치가 만든 초안이 여기에 표시됩니다.
        </p>
      ) : (
        translations.map((translation) => (
          <TranslationEditor
            key={translation.locale}
            memeId={memeId}
            memeUpdatedAt={memeUpdatedAt}
            translation={translation}
            hasOpenAiReviewKey={hasOpenAiReviewKey}
          />
        ))
      )}
    </section>
  );
}
