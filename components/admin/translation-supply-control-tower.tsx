import Link from "next/link";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import {
  buildTranslationSupplyTower,
  sortTranslationSupplyPriorityRows,
  type TranslationSupplyCoverageInput,
  type TranslationSupplyNextAction,
  type TranslationSupplyPriorityInput,
} from "@/lib/translation-supply-control-tower";

const NEXT_ACTION_LABELS: Record<TranslationSupplyNextAction, string> = {
  plus_missing: "Plus 요청 누락부터",
  plus_review: "Plus 요청 검수부터",
  review: "기계 번역 검수부터",
  stale: "원문 변경 재검수부터",
  missing: "누락 번역 보충부터",
  ready: "현재 검수 완료",
};

const NEXT_ACTION_STYLES: Record<TranslationSupplyNextAction, string> = {
  plus_missing: "bg-accent-soft text-accent-text",
  plus_review: "bg-accent-soft text-accent-text",
  review: "bg-safety-yellow-bg text-safety-yellow",
  stale: "bg-safety-red-bg text-safety-red",
  missing: "bg-surface-2 text-muted",
  ready: "bg-surface-2 text-muted",
};

function reviewHref(
  locale: TranslationSupplyCoverageInput["locale"],
  status: "machine" | "stale" | "reviewed",
) {
  return `/admin/translations?locale=${encodeURIComponent(locale)}&status=${status}`;
}

function priorityHref(row: TranslationSupplyPriorityInput) {
  return row.translationStatus === null
    ? `/admin/translations?locale=${encodeURIComponent(row.locale)}&focus=${encodeURIComponent(row.memeId)}`
    : `/admin/memes/${encodeURIComponent(row.memeId)}`;
}

function nextActionHref({
  locale,
  nextAction,
  priorityRows,
}: {
  locale: TranslationSupplyCoverageInput["locale"];
  nextAction: TranslationSupplyNextAction;
  priorityRows: readonly TranslationSupplyPriorityInput[];
}) {
  const priorityRow = priorityRows[0];
  if (priorityRow && (nextAction === "plus_missing" || nextAction === "plus_review")) {
    return priorityHref(priorityRow);
  }
  if (nextAction === "review") return reviewHref(locale, "machine");
  if (nextAction === "stale") return reviewHref(locale, "stale");
  if (nextAction === "ready") return reviewHref(locale, "reviewed");
  return `/admin/translations?locale=${encodeURIComponent(locale)}`;
}

export function TranslationSupplyControlTower({
  coverageRows,
  priorityRows,
  coverageError = null,
  priorityError = null,
}: {
  coverageRows: readonly TranslationSupplyCoverageInput[];
  priorityRows: readonly TranslationSupplyPriorityInput[];
  coverageError?: string | null;
  priorityError?: string | null;
}) {
  const rows = buildTranslationSupplyTower(coverageRows, priorityRows);
  const topCandidate = sortTranslationSupplyPriorityRows(priorityRows)[0];

  return (
    <section
      aria-labelledby="translation-supply-control-tower-title"
      className="rounded-2xl border border-accent/30 bg-accent-soft/15 p-5"
      data-translation-supply-control-tower
    >
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          GLOBAL SUPPLY CONTROL TOWER
        </p>
        <h2 id="translation-supply-control-tower-title" className="mt-1 text-xl font-bold">
          글로벌 번역 공급 다음 행동
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          공개 원문 품질과 Plus 수요를 함께 보고, 로케일별로 지금 열어야 할 검수 큐를 결정합니다.
          이 표면은 읽기 전용이며 초안 생성·저장·공개 발행을 자동으로 실행하지 않습니다.
        </p>
      </div>

      {coverageError && (
        <p
          className="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red"
          role="alert"
        >
          번역 공급 현황을 불러오지 못했어요. 0건으로 간주하지 않았습니다: {coverageError}
        </p>
      )}
      {priorityError && (
        <p
          className="mt-3 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red"
          role="alert"
        >
          Plus 수요와 라우트 후보를 불러오지 못했어요. 0건으로 간주하지 않았습니다: {priorityError}
        </p>
      )}

      {!coverageError && rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          표시할 글로벌 공급 현황이 아직 없어요.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const href = nextActionHref(row);
            return (
              <article key={row.locale} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                      {LANGUAGE_NAMES[row.locale]} <span className="font-mono">{row.locale}</span>
                    </p>
                    <p className="mt-1 text-base font-bold">{NEXT_ACTION_LABELS[row.nextAction]}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${NEXT_ACTION_STYLES[row.nextAction]}`}
                  >
                    {row.nextActionCount}건
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-5">
                  <span>최신 {row.reviewedCurrent}/{row.totalPublic}</span>
                  <span>검토 {row.reviewNeeded}</span>
                  <span>변경 {row.stale}</span>
                  <span>누락 {row.missing}</span>
                  <span>{priorityError ? "Plus 확인 불가" : `Plus ${row.requestCount}`}</span>
                </div>
                <Link
                  href={href}
                  className="mt-3 inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4"
                >
                  {row.nextAction === "ready" ? "완료 상태 확인" : "이 로케일 작업 열기"}
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {!priorityError && topCandidate && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-text">
                {topCandidate.routeUnlockCandidate
                  ? "NEXT ROUTE-UNLOCK CANDIDATE"
                  : "NEXT PLUS DEMAND CANDIDATE"}
              </p>
              <p className="mt-1 text-base font-bold">{topCandidate.memeTitle}</p>
              <p className="mt-1 text-xs text-muted">
                {LANGUAGE_NAMES[topCandidate.locale]} · Plus {topCandidate.requestCount}건 요청 · {topCandidate.memeShortId}
              </p>
            </div>
            <Link
              href={priorityHref(topCandidate)}
              className="inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-3 text-sm font-bold text-white"
            >
              {topCandidate.translationStatus === null ? "누락 검수 열기" : "원문 검수 열기"}
            </Link>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {topCandidate.routeUnlockCandidate
              ? "원문이 현재 색인 가능 기준을 충족하므로, 이 로케일의 reviewed 번역이 라우트 공급을 직접 늘릴 수 있습니다."
              : "Plus 수요가 높은 항목입니다. 원문 revision과 번역 상태를 확인한 뒤 검수하세요."}
          </p>
        </div>
      )}
    </section>
  );
}
