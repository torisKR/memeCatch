"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  previewMissingMemeTranslationWithGpt,
  saveMissingMemeTranslationDraft,
  type TranslationAiReviewDraft,
  type TranslationPriorityQueueRow,
} from "@/lib/actions/admin-translations";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import type { SeoContentLocale } from "@/lib/i18n-routing";

export type MissingTranslationSourceRow = {
  memeId: string;
  shortId: string;
  title: string;
  updatedAt: string;
  routeUnlockCandidate: boolean;
};

type PreviewState = {
  row: MissingTranslationSourceRow;
  draft: TranslationAiReviewDraft;
  sourceUpdatedAt: string;
};

type DraftForm = Pick<
  TranslationAiReviewDraft,
  "title" | "summary" | "description" | "origin" | "usage_note" | "caution" | "aliases"
>;

const RECOMMENDATION_COPY: Record<TranslationAiReviewDraft["recommendation"], string> = {
  approve: "발행 가능",
  edit: "수정 후 검토",
  reject: "발행 보류",
};

const CONFIDENCE_COPY: Record<TranslationAiReviewDraft["confidence"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function textList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{value || "—"}</dd>
    </div>
  );
}

function DraftField({
  label,
  value,
  multiline = false,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      )}
    </label>
  );
}

export function MissingTranslationDraftPreview({
  locale,
  rows,
  initialError = null,
  focusMemeId = null,
  priorityRows = [],
}: {
  locale: SeoContentLocale | null;
  rows: MissingTranslationSourceRow[];
  initialError?: string | null;
  focusMemeId?: string | null;
  priorityRows?: readonly TranslationPriorityQueueRow[];
}) {
  const router = useRouter();
  const [loadingMemeId, setLoadingMemeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [saved, setSaved] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [form, setForm] = useState<DraftForm | null>(null);
  const operatorLane = locale === "zh";
  const [activeOperatorMemeId, setActiveOperatorMemeId] = useState<string | null>(
    focusMemeId ?? (operatorLane ? rows[0]?.memeId ?? null : null),
  );
  const priorityByMemeId = new Map(
    priorityRows
      .filter((row) => row.locale === locale && row.translationStatus === null)
      .map((row) => [row.memeId, row] as const),
  );

  async function requestPreview(row: MissingTranslationSourceRow) {
    if (!locale || loadingMemeId) return;

    setError(null);
    setSaved(null);
    setPreview(null);
    setForm(null);
    setActiveOperatorMemeId(row.memeId);
    setLoadingMemeId(row.memeId);
    try {
      const result = await previewMissingMemeTranslationWithGpt({
        memeId: row.memeId,
        locale,
        expectedSourceUpdatedAt: row.updatedAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview({
        row,
        draft: result.data.draft,
        sourceUpdatedAt: result.data.sourceUpdatedAt,
      });
      setForm({
        title: result.data.draft.title,
        summary: result.data.draft.summary,
        description: result.data.draft.description,
        origin: result.data.draft.origin,
        usage_note: result.data.draft.usage_note,
        caution: result.data.draft.caution,
        aliases: result.data.draft.aliases,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "번역 초안 미리보기를 만들지 못했어요.");
    } finally {
      setLoadingMemeId(null);
    }
  }

  function updateTextField(field: Exclude<keyof DraftForm, "aliases">, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateAliases(value: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            aliases: value
              .split(/[\n,]/)
              .map((alias) => alias.trim())
              .filter(Boolean),
          }
        : current,
    );
  }

  async function saveDraft() {
    if (!locale || !preview || !form || saving) return;

    setError(null);
    setSaved(null);
    setSaving(true);
    try {
      const result = await saveMissingMemeTranslationDraft({
        memeId: preview.row.memeId,
        locale,
        expectedSourceUpdatedAt: preview.sourceUpdatedAt,
        title: form.title,
        summary: form.summary,
        description: form.description,
        origin: form.origin,
        usageNote: form.usage_note,
        caution: form.caution,
        aliases: form.aliases,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (operatorLane) {
        const currentIndex = rows.findIndex((row) => row.memeId === preview.row.memeId);
        const nextRow = currentIndex >= 0 ? rows[currentIndex + 1] : undefined;
        setPreview(null);
        setForm(null);
        setActiveOperatorMemeId(nextRow?.memeId ?? null);
        setSaved(
          nextRow
            ? `machine 초안을 저장했어요. 공개 발행은 아직 되지 않았습니다. 다음 후보: ${nextRow.title}`
            : "machine 초안을 저장했어요. 공개 발행은 아직 되지 않았습니다. 이 배치의 후보를 모두 처리했어요.",
        );
      } else {
        setSaved("machine 초안을 검수 큐에 저장했어요. 공개 발행은 아직 되지 않았습니다.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "번역 초안을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="missing-translation-draft-preview-title"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
        GPT TRANSLATION PREVIEW
      </p>
      <h2 id="missing-translation-draft-preview-title" className="mt-1 text-xl font-bold">
        누락 번역 초안 미리보기
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        버튼을 누른 원문만 GPT-5.6 Sol high로 번역 초안을 미리 봅니다. 자동 실행·저장·발행은
        하지 않습니다.
      </p>

      {!locale ? (
        <p className="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
          번역 초안을 미리 볼 로케일을 먼저 선택해 주세요.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold">
            선택 로케일: {LANGUAGE_NAMES[locale]} ({locale})
          </p>

          {operatorLane && (
            <div
              className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/15 p-4"
              data-translation-operator-lane="zh"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
                ZH ROUTE-UNLOCK OPERATOR LANE
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Plus 번역 요청을 먼저 처리하고, 그다음 번역으로 글로벌 route를 열 수 있는 원문을
                처리합니다. 저장은 machine 초안으로만 남고, GPT 미리보기와 사람 검수는 계속
                명시적으로 실행합니다.
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red"
            >
              {error}
            </p>
          )}

          {rows.length === 0 ? (
            <p className="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
              이 로케일에서 미리 볼 누락 번역 원문이 없어요.
            </p>
          ) : (
            <ul
              className="mt-4 space-y-3"
              aria-label={`${LANGUAGE_NAMES[locale]} ${operatorLane ? "Route-Unlock 운영 큐" : "누락 번역 원문"}`}
            >
              {rows.map((row) => {
                const loading = loadingMemeId === row.memeId;
                const focused = focusMemeId === row.memeId;
                const priority = priorityByMemeId.get(row.memeId);
                const active = operatorLane && activeOperatorMemeId === row.memeId;
                return (
                  <li
                    key={row.memeId}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                      active ? "border-accent bg-accent-soft/10" : "border-border bg-surface-2"
                    }`}
                    data-translation-operator-row={operatorLane ? "true" : undefined}
                    data-translation-operator-active={active ? "true" : "false"}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{row.title}</p>
                      <p className="mt-1 font-mono text-xs text-muted">{row.shortId}</p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          row.routeUnlockCandidate
                            ? "bg-accent-soft text-accent-text"
                            : "bg-surface text-muted"
                        }`}
                        data-translation-route-unlock={row.routeUnlockCandidate ? "candidate" : "blocked"}
                      >
                        {row.routeUnlockCandidate
                          ? "번역 후 글로벌 공개 후보"
                          : "원문 보강 필요"}
                      </span>
                      {focused && (
                        <span className="mt-2 inline-flex rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-text">
                          Plus 요청 우선
                        </span>
                      )}
                      {priority && (
                        <span
                          className="mt-2 inline-flex rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-text"
                          data-translation-plus-priority="true"
                        >
                          Plus {priority.requestCount}건 요청
                        </span>
                      )}
                      {active && (
                        <span className="mt-2 inline-flex rounded-full bg-surface px-2 py-1 text-xs font-semibold text-accent-text">
                          현재 후보
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={loadingMemeId !== null}
                      aria-label={`${row.title} GPT-5.6 Sol high 번역 초안 미리보기`}
                      onClick={() => requestPreview(row)}
                      className="min-h-11 rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      {loading ? "GPT-5.6 Sol high 생성 중…" : "GPT-5.6 Sol high로 미리보기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {loadingMemeId && (
            <p role="status" className="mt-4 text-sm font-semibold text-accent-text">
              GPT-5.6 Sol high가 읽기 전용 번역 초안을 만들고 있어요.
            </p>
          )}

          {preview && (
            <article
              aria-labelledby="translation-draft-preview-result-title"
              className="mt-5 rounded-xl border border-accent/30 bg-background p-5"
            >
              <h3 id="translation-draft-preview-result-title" className="text-lg font-bold">
                {preview.row.title} 번역 초안 미리보기
              </h3>
              <p className="mt-2 rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm font-semibold leading-relaxed text-safety-yellow">
                이 미리보기는 저장되거나 발행되지 않았습니다. 반드시 사람이 검토해야 합니다.
              </p>
              <dl className="mt-4 grid gap-4 lg:grid-cols-2">
                <PreviewField label="title" value={preview.draft.title} />
                <PreviewField label="summary" value={preview.draft.summary} />
                <PreviewField label="description" value={preview.draft.description} />
                <PreviewField label="origin" value={preview.draft.origin} />
                <PreviewField label="usage_note" value={preview.draft.usage_note} />
                <PreviewField label="caution" value={preview.draft.caution} />
                <PreviewField label="aliases" value={textList(preview.draft.aliases)} />
                <PreviewField
                  label="recommendation"
                  value={`${RECOMMENDATION_COPY[preview.draft.recommendation]} (${preview.draft.recommendation})`}
                />
                <PreviewField
                  label="confidence"
                  value={`${CONFIDENCE_COPY[preview.draft.confidence]} (${preview.draft.confidence})`}
                />
                <PreviewField label="review_notes" value={textList(preview.draft.review_notes)} />
              </dl>
              {form && (
                <div className="mt-6 rounded-xl border border-border bg-surface-2 p-4">
                  <h4 className="text-base font-bold">운영자 편집본</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    내용을 직접 다듬은 뒤 저장해야 기존 machine 검수 큐에 들어갑니다.
                  </p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <DraftField
                      label="title"
                      value={form.title}
                      onChange={(value) => updateTextField("title", value)}
                    />
                    <DraftField
                      label="summary"
                      value={form.summary}
                      multiline
                      onChange={(value) => updateTextField("summary", value)}
                    />
                    <DraftField
                      label="description"
                      value={form.description}
                      multiline
                      onChange={(value) => updateTextField("description", value)}
                    />
                    <DraftField
                      label="origin"
                      value={form.origin}
                      multiline
                      onChange={(value) => updateTextField("origin", value)}
                    />
                    <DraftField
                      label="usage_note"
                      value={form.usage_note}
                      multiline
                      onChange={(value) => updateTextField("usage_note", value)}
                    />
                    <DraftField
                      label="caution"
                      value={form.caution}
                      multiline
                      onChange={(value) => updateTextField("caution", value)}
                    />
                    <DraftField
                      label="aliases"
                      value={form.aliases.join("\n")}
                      multiline
                      onChange={updateAliases}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="mt-5 min-h-11 rounded-lg bg-accent-strong px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving ? "검수 대기 초안 저장 중…" : "검수 대기 초안 저장"}
                  </button>
                </div>
              )}
            </article>
          )}
          {saved && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent-text"
            >
              {saved}
            </p>
          )}
        </>
      )}
    </section>
  );
}
