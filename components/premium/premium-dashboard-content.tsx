"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n-client";
import { toBcp47 } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { EXPIRY_WARNING_DAYS, daysUntilExpiry } from "@/lib/billing/entitlements";
import { PremiumGate } from "@/components/premium/premium-gate";
import { CONTACT_EMAIL } from "@/lib/site";
import type { UnifiPaymentHistoryItem } from "@/lib/billing/repository.server";


export function PremiumDashboardContent({
  isPremium,
  status,
  currentPeriodEnd,
  feed,
  history = [],
}: {
  isPremium: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  feed: ReactNode;
  history?: UnifiPaymentHistoryItem[];
}) {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale];
  const accessConfirmedThrough = currentPeriodEnd
    ? new Intl.DateTimeFormat(toBcp47(locale), { dateStyle: "long" }).format(new Date(currentPeriodEnd))
    : null;
  const remainingDays = daysUntilExpiry(currentPeriodEnd);

  return (
    <main
      data-membership-status={status ?? "none"}
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12"
    >
      <header className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-9">
        <p className="text-xs font-black tracking-[0.18em] text-accent-text">{copy.dashboard.eyebrow}</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-balance text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              {isPremium ? copy.dashboard.activeTitle : copy.dashboard.upgradeTitle}
            </h1>
            <p className="mt-3 text-pretty leading-relaxed text-muted sm:text-lg">
              {isPremium ? copy.dashboard.activeBody : copy.dashboard.upgradeBody}
            </p>
          </div>
          {isPremium && (
            <span className="inline-flex w-fit rounded-full bg-accent-soft px-3 py-1.5 text-xs font-black tracking-wider text-accent-text">
              {copy.productName}
            </span>
          )}
        </div>
      </header>

      {isPremium ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <div className="min-w-0 [&>*:first-child]:mt-0">{feed}</div>
          <aside className="edge-signal holo-sheen relative overflow-hidden rounded-2xl p-5 lg:sticky lg:top-20">
            {/* 계측 격자 — edge-signal의 background shorthand와 같은 노드에 두면
                grid-line이 지워지므로 별도 레이어로 둔다(status-panel.tsx 문법 재사용). */}
            <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
            <div className="relative">
              <h2 className="font-bold">{copy.dashboard.membershipStatus}</h2>
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-safety-green">
                <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
                {copy.dashboard.active}
              </p>
              {accessConfirmedThrough && (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {copy.dashboard.renews}<br />
                  <strong className="text-foreground">{accessConfirmedThrough}</strong>
                </p>
              )}

              {/* 자동 갱신이 없으므로 만료가 임박하면 직접 연장하도록 알린다. */}
              {remainingDays !== null && remainingDays <= EXPIRY_WARNING_DAYS && (
                <p
                  role="status"
                  className="mt-3 rounded-xl bg-safety-yellow-bg px-3 py-2 text-sm leading-relaxed text-safety-yellow"
                >
                  {copy.dashboard.expiringSoon(remainingDays)}
                </p>
              )}

              {/* 연장 = 새 결제. 체크아웃이 결제 링크를 다시 발급한다. */}
              <form action="/api/billing/checkout" method="post" className="mt-4">
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {copy.dashboard.extend}
                </button>
              </form>
              {/* 결제 이력 — 실제 웹훅 이벤트만(미결제 시도는 제외). UX 감사 gap #4 */}
              <h3 className="mt-6 border-t border-border pt-4 text-sm font-bold">
                {copy.dashboard.historyTitle}
              </h3>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{copy.dashboard.historyEmpty}</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {history.map((item) => (
                    <li
                      key={`${item.orderId}-${item.occurredAt}`}
                      className="-mx-2 flex items-baseline justify-between gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-surface-2"
                    >
                      <time dateTime={item.occurredAt} className="text-muted">
                        {new Intl.DateTimeFormat(toBcp47(locale), { dateStyle: "medium" }).format(
                          new Date(item.occurredAt),
                        )}
                      </time>
                      <span className="stat-mono font-semibold text-accent-text">
                        {item.status === "canceled"
                          ? copy.dashboard.historyCanceled
                          : item.amount !== null
                            ? `$${(item.amount / 100).toFixed(2)}`
                            : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=MemeCatch%20Plus%20billing`}
                className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copy.dashboard.billingHelp}
              </a>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-2xl">
          <PremiumGate />
          <p className="mt-4 text-center text-sm leading-relaxed text-muted">{copy.dashboard.syncNote}</p>
          <p className="mt-2 text-center">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=MemeCatch%20Plus%20billing`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.dashboard.billingHelp}
            </a>
          </p>
        </div>
      )}
    </main>
  );
}
