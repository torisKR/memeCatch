import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { toBcp47 } from "@/lib/i18n";
import { localizedMemePath } from "@/lib/i18n-routing";
import type {
  PlusTranslationFulfillmentResult,
  PlusTranslationFulfillmentState,
} from "@/lib/plus-translation-fulfillment";

export type PlusTranslationFulfillmentCopy = {
  heading: string;
  body: string;
  statusLabels: Record<PlusTranslationFulfillmentState, string>;
  timestampLabels: Record<PlusTranslationFulfillmentState, string>;
  openLink: string;
  empty: { heading: string; body: string };
  unavailable: { heading: string; body: string };
};

export type PlusTranslationFulfillmentCenterProps = {
  fulfillment: PlusTranslationFulfillmentResult;
  locale: Locale;
  copy: PlusTranslationFulfillmentCopy;
};

const STATE_CLASS: Record<PlusTranslationFulfillmentState, string> = {
  requested: "bg-surface-2 text-muted",
  in_review: "bg-accent-soft text-accent-text",
  ready: "bg-safety-green-bg text-safety-green",
  stale: "bg-safety-yellow-bg text-safety-yellow",
  source_incomplete: "bg-safety-yellow-bg text-safety-yellow",
  dismissed: "bg-safety-gray-bg text-safety-gray",
};

export function PlusTranslationFulfillmentCenter({
  fulfillment,
  locale,
  copy,
}: PlusTranslationFulfillmentCenterProps) {
  const dateFormatter = new Intl.DateTimeFormat(toBcp47(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section
      aria-labelledby="plus-translation-fulfillment-title"
      data-plus-translation-fulfillment={fulfillment.status}
      className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="max-w-2xl">
        <h2
          id="plus-translation-fulfillment-title"
          className="text-xl font-bold tracking-tight"
        >
          {copy.heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.body}</p>
      </div>

      {fulfillment.status === "unavailable" ? (
        <FulfillmentMessage copy={copy.unavailable} />
      ) : fulfillment.status === "empty" ? (
        <FulfillmentMessage copy={copy.empty} />
      ) : (
        <ol className="mt-5 grid gap-3 lg:grid-cols-2">
          {fulfillment.items.map((item) => (
            <li
              key={item.requestId}
              data-fulfillment-state={item.state}
              data-request-status={item.requestStatus}
              className="flex min-w-0 flex-col rounded-xl border border-border bg-surface-2 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    {item.locale}
                  </span>
                  <h3 className="mt-1 text-base font-bold leading-snug">
                    {item.title}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATE_CLASS[item.state]}`}
                >
                  {copy.statusLabels[item.state]}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted">
                <span className="font-semibold">
                  {copy.timestampLabels[item.state]}:
                </span>{" "}
                <time dateTime={item.changedAt}>
                  {formatTimestamp(item.changedAt, dateFormatter)}
                </time>
              </p>

              {item.state === "ready" ? (
                <Link
                  href={localizedMemePath(item.locale, item.shortId, item.slug)}
                  className="mt-4 inline-flex min-h-10 items-center self-start rounded-xl font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {copy.openLink}
                  <span aria-hidden> →</span>
                </Link>
              ) : (
                <span className="mt-4 text-xs font-semibold text-muted" role="status">
                  {copy.statusLabels[item.state]}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FulfillmentMessage({
  copy,
}: {
  copy: PlusTranslationFulfillmentCopy["empty"];
}) {
  return (
    <div className="mt-5 rounded-xl bg-surface-2 p-4" role="status">
      <h3 className="text-base font-bold">{copy.heading}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{copy.body}</p>
    </div>
  );
}

function formatTimestamp(
  value: string,
  formatter: Intl.DateTimeFormat,
): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}
