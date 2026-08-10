import Link from "next/link";
import type { PlusNextMoveCopy, PlusNextMoveResult } from "@/lib/plus-next-move";

export function PlusNextMove({
  result,
  copy,
  onActivate,
}: {
  result: PlusNextMoveResult;
  copy: PlusNextMoveCopy;
  onActivate?: (memeId: string) => void;
}) {
  return (
    <section
      data-plus-next-move={result.status}
      aria-labelledby="plus-next-move-title"
      className="mt-4 rounded-xl border border-accent/40 bg-surface p-4"
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">
        {copy.eyebrow}
      </p>
      {result.status === "ready" && result.item ? (
        <>
          <h3 id="plus-next-move-title" className="mt-1 text-base font-black text-accent-text">
            {copy.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.description}</p>
          <p className="mt-3 text-xs font-semibold text-accent-text">
            {result.confidence === "learning"
              ? copy.confidence.learning(result.ratedCount)
              : copy.confidence.ready(result.ratedCount)}
          </p>
          {onActivate ? (
            <button
              type="button"
              data-plus-next-move-action="activate"
              onClick={() => onActivate(result.item!.memeId)}
              aria-label={`${copy.activate}: ${result.item.title}`}
              className="mt-3 block w-full rounded-lg border border-border bg-surface-2 p-3 text-left transition-colors hover:border-accent/60 hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="block text-sm font-black text-foreground">{result.item.title}</span>
              {result.item.summary && (
                <span className="mt-1 block text-xs leading-relaxed text-muted">{result.item.summary}</span>
              )}
              <span className="mt-2 block text-xs font-semibold text-accent-text">
                {copy.signal[result.signal]}
              </span>
              <span className="mt-2 block text-xs font-bold text-accent-text">
                {copy.activate}
                <span aria-hidden> →</span>
              </span>
            </button>
          ) : (
            <Link
              href={result.item.href}
              data-plus-next-move-action="open"
              className="mt-3 block rounded-lg border border-border bg-surface-2 p-3 transition-colors hover:border-accent/60 hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="block text-sm font-black text-foreground">{result.item.title}</span>
              {result.item.summary && (
                <span className="mt-1 block text-xs leading-relaxed text-muted">{result.item.summary}</span>
              )}
              <span className="mt-2 block text-xs font-semibold text-accent-text">
                {copy.signal[result.signal]}
              </span>
              <span className="mt-2 block text-xs font-bold text-accent-text">
                {copy.open}
                <span aria-hidden> →</span>
              </span>
            </Link>
          )}
        </>
      ) : result.status === "empty" ? (
        <>
          <h3 id="plus-next-move-title" className="mt-1 text-base font-black text-accent-text">
            {copy.empty.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.empty.body}</p>
        </>
      ) : (
        <>
          <h3 id="plus-next-move-title" className="mt-1 text-base font-black text-accent-text">
            {copy.unavailable.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.unavailable.body}</p>
        </>
      )}
    </section>
  );
}
