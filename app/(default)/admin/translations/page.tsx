import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import {
  getTranslationCoverage,
  listMissingMemeTranslations,
  listTranslationPriorityQueue,
  listTranslationSupplyPriorityQueue,
  listTranslationsForReview,
  type TranslationReviewStatus,
} from "@/lib/actions/admin-translations";
import { TranslationReviewQueue } from "@/components/admin/translation-review";
import { TranslationPriorityQueue } from "@/components/admin/translation-priority-queue";
import { TranslationCoveragePanel } from "@/components/admin/translation-coverage-panel";
import { TranslationSupplyControlTower } from "@/components/admin/translation-supply-control-tower";
import { MissingTranslationDraftPreview } from "@/components/admin/missing-translation-draft-preview";
import { SEO_CONTENT_LOCALES, isSeoContentLocale, type SeoContentLocale } from "@/lib/i18n-routing";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import { missingTranslationPriorityMemeIds } from "@/lib/translation-worklist";

export const metadata = { title: "번역 검수" };

const STATUS_FILTERS = ["machine", "reviewed", "stale"] as const satisfies readonly TranslationReviewStatus[];
const STATUS_LABELS: Record<TranslationReviewStatus, string> = {
  machine: "검수 전",
  reviewed: "검수 완료",
  stale: "원문 변경",
};

function isTranslationStatus(value: string): value is TranslationReviewStatus {
  return (STATUS_FILTERS as readonly string[]).includes(value);
}

export default async function AdminTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; status?: string; page?: string; focus?: string }>;
}) {
  // 방어심화 — 미들웨어와 별개로 페이지에서 operator 재검증
  await requireOperatorPage("/admin/translations");
  const { locale = "", status = "machine", page = "1", focus = "" } = await searchParams;
  const localeFilter: SeoContentLocale | undefined = isSeoContentLocale(locale) ? locale : undefined;
  const statusFilter: TranslationReviewStatus | undefined = isTranslationStatus(status) ? status : undefined;

  const [priorityResult, supplyPriorityResult] = await Promise.all([
    listTranslationPriorityQueue(50, localeFilter),
    listTranslationSupplyPriorityQueue(50),
  ]);
  const priorityMemeIds =
    localeFilter && priorityResult.ok
      ? missingTranslationPriorityMemeIds(priorityResult.data, localeFilter)
      : [];
  const [result, coverageResult, missingResult] = await Promise.all([
    listTranslationsForReview({
      locale: localeFilter,
      status: statusFilter,
      page: Number(page) || 1,
    }),
    getTranslationCoverage(),
    localeFilter
      ? listMissingMemeTranslations({
          locale: localeFilter,
          limit: 20,
          focusMemeId: focus || undefined,
          priorityMemeIds,
        })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);
  if (!result.ok) throw new Error(`번역 검수 목록을 불러오지 못했어요: ${result.error}`);

  const { rows, page: currentPage, pageSize, total } = result.data;
  const priorityRows = priorityResult.ok ? priorityResult.data : [];
  const supplyPriorityRows = supplyPriorityResult.ok ? supplyPriorityResult.data : [];
  const coverageRows = coverageResult.ok ? coverageResult.data : [];
  const missingRows = missingResult.ok ? missingResult.data : [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (locale) params.set("locale", locale);
    if (status) params.set("status", status);
    params.set("page", String(target));
    return `/admin/translations?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">번역 검수</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          오프라인 번역 배치가 만든 초안을 밈 전체에서 모아 검수합니다. GPT-5.6 Sol high가
          원문과 번역을 대조해 교정본·신뢰도·발행 의견을 만들고, 공개 발행은 운영자가 최종
          승인합니다.
        </p>
      </div>

      <TranslationSupplyControlTower
        coverageRows={coverageRows}
        priorityRows={supplyPriorityRows}
        coverageError={coverageResult.ok ? null : coverageResult.error}
        priorityError={supplyPriorityResult.ok ? null : supplyPriorityResult.error}
      />

      <TranslationPriorityQueue
        rows={priorityRows}
        error={priorityResult.ok ? null : priorityResult.error}
      />

      <TranslationCoveragePanel
        rows={coverageRows}
        error={coverageResult.ok ? null : coverageResult.error}
      />

      <MissingTranslationDraftPreview
        locale={localeFilter ?? null}
        rows={missingRows}
        initialError={missingResult.ok ? null : missingResult.error}
        focusMemeId={focus || null}
        priorityRows={priorityRows}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-base font-medium">언어</span>
          <select
            name="locale"
            defaultValue={locale}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
          >
            <option value="">전체</option>
            {SEO_CONTENT_LOCALES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">검수 상태</span>
          <select
            name="status"
            defaultValue={status}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
          >
            <option value="">전체</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white"
        >
          적용
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-lg font-semibold">조건에 맞는 번역이 없어요</p>
          <p className="mt-1 text-base text-muted">필터를 바꾸거나 잠시 후 다시 확인해 주세요.</p>
        </div>
      ) : (
        <>
          <TranslationReviewQueue
            rows={rows}
            hasOpenAiReviewKey={Boolean(process.env.OPENAI_API_KEY?.trim())}
          />
          {totalPages > 1 && (
            <nav aria-label="페이지" className="flex items-center justify-center gap-3 pt-2">
              <Link
                href={pageHref(Math.max(1, currentPage - 1))}
                aria-disabled={currentPage <= 1}
                className={`min-h-11 rounded-lg border border-border px-4 py-2 text-base ${
                  currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-2"
                }`}
              >
                이전
              </Link>
              <span className="text-sm text-muted tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Link
                href={pageHref(Math.min(totalPages, currentPage + 1))}
                aria-disabled={currentPage >= totalPages}
                className={`min-h-11 rounded-lg border border-border px-4 py-2 text-base ${
                  currentPage >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-surface-2"
                }`}
              >
                다음
              </Link>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
