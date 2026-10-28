import type { PublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export function MemeExternalTrendEvidence({
  evidence,
}: {
  evidence: PublicMemeTrendSummary | null;
}) {
  if (!evidence) return null;

  return (
    <section aria-labelledby="why-trending-title" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="why-trending-title" className="text-base font-bold">
          {evidence.stale ? "마지막 확산 관찰" : "왜 지금 뜨나요?"}
        </h2>
        <span className="text-xs font-semibold text-accent-text">
          {evidence.stale
            ? (evidence.state === "revival" ? "재유행 관찰 기록" : "상승 관찰 기록")
            : (evidence.state === "revival" ? "재유행" : "외부 확산 상승")}
        </span>
        {evidence.stale && <span className="text-xs font-semibold text-safety-yellow">오래된 관찰</span>}
      </div>
      <p className="whitespace-pre-line text-sm leading-7">{evidence.reason}</p>
      {evidence.stale && (
        <p className="text-sm text-muted">현재 확산 여부는 다시 확인해야 해요.</p>
      )}
      <details className="border-t border-border">
        <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted focus-visible:outline-offset-4">
          확산 근거 · 독립 사용례 {evidence.independentUseCount}건
        </summary>
        <dl className="space-y-2 text-xs text-muted">
          <div><dt className="inline font-semibold">조사 범위: </dt><dd className="inline">{evidence.evidenceScope}</dd></div>
          <div><dt className="inline font-semibold">마지막 확인: </dt><dd className="inline"><time dateTime={evidence.lastVerifiedAt}>{dateFormatter.format(new Date(evidence.lastVerifiedAt))}</time></dd></div>
        </dl>
        {evidence.evidenceLinks.length > 0 && (
          <ul className="mt-3 space-y-1" aria-label="확산 근거 링크">
            {evidence.evidenceLinks.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline decoration-border underline-offset-4 hover:text-accent-text">
                  {link.label} <span aria-hidden className="ml-1">↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs leading-6 text-muted">
          이 표시는 조사 범위 안의 관찰이며, 전체 인터넷이나 전체 SNS의 인기도를 뜻하지 않아요. 사용 안전 신호와는 별개입니다.
        </p>
      </details>
    </section>
  );
}
