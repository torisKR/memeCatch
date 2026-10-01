import Link from "next/link";

export type CatalogProvenanceSource = {
  source_id: string;
  source_role: string;
  rights_basis: string;
  review_state: string;
  reviewer_note: string | null;
  media_sources: {
    canonical_url: string;
    title: string | null;
    platform: string;
  } | null;
};

type Props = {
  dates: {
    sourceWorkYear: number | null;
    memeFirstSeenYear: number | null;
    koreaViralYear: number | null;
    yearPrecision: string;
  };
  tags: string[];
  sources: CatalogProvenanceSource[];
};

export function CatalogProvenancePanel({ dates, tags, sources }: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">외부 밈 등록 근거</h2>
          <p className="mt-1 text-sm text-muted">등록 당시의 날짜·태그·출처·권리 검수 상태입니다.</p>
        </div>
        <Link href="/admin/sources" className="text-sm font-semibold text-accent-text underline">
          출처 검수 대기열
        </Link>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-muted">원작 연도</dt><dd className="font-medium">{dates.sourceWorkYear ?? "미상"}</dd></div>
        <div><dt className="text-muted">최초 밈 확인</dt><dd className="font-medium">{dates.memeFirstSeenYear ?? "미상"}</dd></div>
        <div><dt className="text-muted">한국 유행</dt><dd className="font-medium">{dates.koreaViralYear ?? "미상"}</dd></div>
        <div><dt className="text-muted">연도 정확도</dt><dd className="font-medium">{dates.yearPrecision}</dd></div>
      </dl>

      <div>
        <p className="text-sm text-muted">태그</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.length > 0 ? tags.map((tag) => (
            <span key={tag} className="rounded-full bg-background px-3 py-1 text-sm">#{tag}</span>
          )) : <span className="text-sm text-muted">등록된 태그 없음</span>}
        </div>
      </div>

      <div className="space-y-3">
        {sources.map((source) => (
          <article key={source.source_id} className="rounded-xl border border-border p-4 text-sm">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="font-semibold">{source.source_role}</span>
              <span className="text-muted">권리: {source.rights_basis}</span>
              <span className="text-muted">검수: {source.review_state}</span>
            </div>
            {source.media_sources && (
              <a
                href={source.media_sources.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block break-all text-accent-text underline"
              >
                {source.media_sources.title || source.media_sources.canonical_url}
              </a>
            )}
            {source.reviewer_note && <p className="mt-2 whitespace-pre-wrap text-muted">{source.reviewer_note}</p>}
          </article>
        ))}
        {sources.length === 0 && <p className="text-sm text-muted">출처 ledger가 없습니다.</p>}
      </div>
    </section>
  );
}
