import Link from "next/link";
import { LANGUAGE_NAMES } from "@/lib/i18n";
import type { SeoContentLocale } from "@/lib/i18n-routing";

export type TranslationCoverageRow = {
  locale: SeoContentLocale;
  totalPublic: number;
  reviewedCurrent: number;
  reviewNeeded: number;
  stale: number;
  missing: number;
  completionPercentage: number;
};

function reviewHref(locale: SeoContentLocale, status: "machine" | "stale") {
  return `/admin/translations?locale=${encodeURIComponent(locale)}&status=${status}`;
}

function ReviewCountLink({
  locale,
  status,
  count,
  label,
}: {
  locale: SeoContentLocale;
  status: "machine" | "stale";
  count: number;
  label: string;
}) {
  if (count === 0) return <span className="tabular-nums">0</span>;

  return (
    <Link
      href={reviewHref(locale, status)}
      aria-label={`${LANGUAGE_NAMES[locale]} ${label} ${count}건 보기`}
      className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4 hover:text-accent"
    >
      {count}
    </Link>
  );
}

function MissingCountLink({
  locale,
  count,
}: {
  locale: SeoContentLocale;
  count: number;
}) {
  if (count === 0) return <span className="tabular-nums">0</span>;

  return (
    <Link
      href={`/admin/translations?locale=${encodeURIComponent(locale)}`}
      aria-label={`${LANGUAGE_NAMES[locale]} 누락 번역 ${count}건 작업 열기`}
      className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4 hover:text-accent"
    >
      {count}
    </Link>
  );
}

export function TranslationCoveragePanel({
  rows,
  error = null,
}: {
  rows: TranslationCoverageRow[];
  error?: string | null;
}) {
  return (
    <section
      aria-labelledby="translation-coverage-title"
      className="rounded-2xl border border-border bg-surface p-5"
      data-translation-coverage-panel
    >
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          GLOBAL TRANSLATION DESK
        </p>
        <h2 id="translation-coverage-title" className="mt-1 text-xl font-bold">
          로케일별 번역 완성도
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          공개 밈을 기준으로 최신 검수본과 후속 작업 대상을 비교합니다.
        </p>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red"
          role="alert"
        >
          번역 현황을 불러오지 못했어요. 0건으로 간주하지 않았습니다. 잠시 후 새로고침해 주세요.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
          표시할 로케일별 번역 현황이 없어요.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">로케일</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">전체 공개</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">검수 완료·최신</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">검토 필요</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">원문 변경</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">누락</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">완료율</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.locale} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {LANGUAGE_NAMES[row.locale]}
                    <span className="ml-1.5 font-mono text-xs font-normal text-muted">
                      {row.locale}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">{row.totalPublic}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.reviewedCurrent}</td>
                  <td className="px-4 py-3 text-right">
                    <ReviewCountLink
                      locale={row.locale}
                      status="machine"
                      count={row.reviewNeeded}
                      label="검토 필요"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReviewCountLink
                      locale={row.locale}
                      status="stale"
                      count={row.stale}
                      label="원문 변경"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MissingCountLink locale={row.locale} count={row.missing} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {row.completionPercentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 rounded-xl bg-safety-yellow-bg px-4 py-3 text-sm leading-relaxed text-safety-yellow">
        누락 행은 오프라인에서 번역 초안을 생성한 뒤 사람의 검토를 거쳐야 합니다. 이 화면에서는
        자동 생성하거나 공개하지 않습니다.
      </p>
    </section>
  );
}
