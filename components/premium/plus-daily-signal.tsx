import Link from "next/link";
import { DAILY_SIGNAL_COPY } from "@/lib/plus-daily-signal-copy";
import { PlusDailyShareAction } from "@/components/premium/plus-daily-share-action";
import type { DailySignalLocale, PlusDailySignalCandidate } from "@/lib/plus-daily-signal.server";
import { isSeoContentLocale, localizedMemePath } from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";

function candidateHref(locale: DailySignalLocale, candidate: PlusDailySignalCandidate): string {
  return isSeoContentLocale(locale)
    ? localizedMemePath(locale, candidate.shortId, candidate.slug)
    : memePathFrom(candidate.shortId, candidate.slug);
}

export function PlusDailySignal({
  candidates,
  locale,
}: {
  candidates: readonly PlusDailySignalCandidate[];
  locale: DailySignalLocale;
}) {
  const copy = DAILY_SIGNAL_COPY[locale];

  return (
    <section
      aria-labelledby="plus-daily-signal-title"
      data-plus-daily-signal
      data-signal-count={candidates.length}
      className="rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            PLUS SIGNAL
          </p>
          <h2 id="plus-daily-signal-title" className="mt-1 text-lg font-bold">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.intro}</p>
        </div>
        <span className="rounded-full border border-accent/30 bg-surface px-2.5 py-1 text-xs font-bold text-accent-text">
          {candidates.length}
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h3 className="font-bold">{copy.emptyTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.emptyBody}</p>
        </div>
      ) : (
        <ol className="mt-4 grid gap-3">
          {candidates.map((candidate, index) => (
            <li key={candidate.id}>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <Link
                  href={candidateHref(locale, candidate)}
                  className="block p-4 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex items-start gap-3">
                    <span className="stat-mono flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-text">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-muted">
                        {candidate.source === "saved_rising" ? copy.savedReason : copy.interestReason}
                      </p>
                      <h3 className="mt-1 font-bold">{candidate.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{candidate.summary}</p>
                      <p className="mt-2 text-xs font-semibold text-accent-text">
                        {copy.safety(candidate.safetyLevel)} · {copy.open}
                      </p>
                    </div>
                  </div>
                </Link>
                {candidate.shareReady && (
                  <PlusDailyShareAction candidate={candidate} locale={locale} />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
