import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { memePathFrom } from "@/lib/labels";
import { PREMIUM_COPY, type PremiumCopy } from "@/lib/i18n-premium";
import {
  buildSavedReuseRadar,
  type SavedReuseRadarItem,
} from "@/lib/saved-reuse-radar";

type Bucket = {
  id: "readyNow" | "checkContext" | "archive";
  items: SavedReuseRadarItem[];
};

/**
 * An always-available destination for the same saved assets that may also
 * receive an occasional rising alert. This component receives only the
 * authenticated owner's server-filtered rows from the Plus dashboard.
 */
export function SavedReuseRadar({
  items,
  locale,
}: {
  items: readonly SavedReuseRadarItem[];
  locale: Locale;
}) {
  const copy = PREMIUM_COPY[locale].dashboard.radar;
  const radar = buildSavedReuseRadar(items);

  if (radar.total === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5" aria-labelledby="saved-reuse-radar-title">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-signal-cyan">
          {copy.eyebrow}
        </p>
        <h2 id="saved-reuse-radar-title" className="mt-1 text-lg font-bold">
          {copy.emptyTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.emptyBody}</p>
        <Link
          href="/explore"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
        >
          {copy.explore}
        </Link>
      </section>
    );
  }

  const buckets: Bucket[] = [
    { id: "readyNow", items: radar.readyNow },
    { id: "checkContext", items: radar.checkContext },
    { id: "archive", items: radar.archive },
  ];

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5" aria-labelledby="saved-reuse-radar-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-signal-cyan">
            {copy.eyebrow}
          </p>
          <h2 id="saved-reuse-radar-title" className="mt-1 text-lg font-bold">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {copy.summary(radar.total)}
          </p>
        </div>
        <Link
          href="/my#saved"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.openLibrary}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {buckets.map(({ id, items: bucketItems }) => (
          <RadarBucket key={id} id={id} items={bucketItems} copy={copy} />
        ))}
      </div>
    </section>
  );
}

function RadarBucket({
  id,
  items,
  copy,
}: {
  id: Bucket["id"];
  items: readonly SavedReuseRadarItem[];
  copy: PremiumCopy["dashboard"]["radar"];
}) {
  const bucket = copy[id];
  return (
    <section className="rounded-xl border border-border bg-surface-2 p-3" aria-label={bucket.title}>
      <h3 className="text-sm font-bold">{bucket.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{bucket.description}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{bucket.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={memePathFrom(item.shortId, item.slug)}
                className="block rounded-lg bg-surface px-3 py-2 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 font-semibold">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {copy.lifecycle[item.lifecycleStatus]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{item.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
