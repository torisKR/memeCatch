"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { toBcp47, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY, type PremiumCopy } from "@/lib/i18n-premium";
import { localizedStaticPath } from "@/lib/i18n-routing";
import type { TrendChangeSummary } from "@/lib/trend/change-summary";

/**
 * Plus 전용 밈 트렌드 추이 패널.
 * 상세 페이지의 SSG를 지키려고 서버에서 구독을 읽지 않고, 뷰포트에 들어올 때
 * /api/memes/[id]/trend를 호출해 권한과 데이터를 함께 받는다.
 * 비구독자에겐 시리즈가 아예 오지 않으므로 HTML로도 데이터가 새지 않는다.
 */

type Point = {
  date: string;
  trend_score: number;
  views: number;
  reactions: number;
  comments: number;
  saves: number;
};

type Payload =
  | { locked: true; reason: "signed_out" | "not_premium" }
  | { locked: false; series: Point[]; summaries: TrendChangeSummary[] };

type MetricKey = "trend_score" | "views" | "reactions";

function trendMetrics(copy: PremiumCopy["trend"]) {
  return [
    { key: "trend_score" as const, label: copy.metricTrendScore },
    { key: "views" as const, label: copy.metricViews },
    { key: "reactions" as const, label: copy.metricReactions },
  ];
}

export function trendPanelUpgradeHref(
  reason: "signed_out" | "not_premium",
  locale: Locale,
): string {
  const pricingPath = localizedStaticPath("/pricing?source=trend_30d", locale);
  return reason === "signed_out"
    ? `/login?next=${encodeURIComponent(pricingPath)}`
    : pricingPath;
}

export function MemeTrendPanel({ memeId }: { memeId: string }) {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale].trend;
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("trend_score");
  const boxRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || loadedRef.current) return;

    const load = () => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      fetch(`/api/memes/${memeId}/trend`, { cache: "no-store" })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("bad status")),
        )
        .then((json: Payload) => setData(json))
        .catch(() => setFailed(true));
    };

    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load();
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [memeId]);

  return (
    <section
      ref={boxRef}
      aria-labelledby="trend-panel-title"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trend-panel-title" className="text-lg font-bold">
          {copy.title}
        </h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text">
          {copy.plusBadge}
        </span>
      </div>

      {failed && <p className="mt-3 text-sm text-muted">{copy.failed}</p>}

      {!failed && data === null && (
        <div
          aria-hidden
          className="mt-4 h-40 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
        />
      )}

      {data?.locked && (
        <LockedTeaser reason={data.reason} copy={copy} locale={locale} />
      )}

      {data && !data.locked && (
        <TrendChart
          series={data.series}
          summaries={data.summaries}
          metric={metric}
          onMetric={setMetric}
          copy={copy}
          locale={locale}
        />
      )}
    </section>
  );
}

function LockedTeaser({
  reason,
  copy,
  locale,
}: {
  reason: "signed_out" | "not_premium";
  copy: PremiumCopy["trend"];
  locale: Locale;
}) {
  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-muted">
        {copy.lockedDescription}
      </p>
      {/* 잠금 상태 시각화 — 실제 수치가 아닌 장식용 곡선 */}
      <div
        aria-hidden
        className="relative mt-4 overflow-hidden rounded-xl border border-border bg-surface-2"
      >
        <svg viewBox="0 0 320 96" className="h-24 w-full" fill="none">
          <path
            className="signal-flicker"
            d="M0 78 L40 70 L80 74 L120 52 L160 58 L200 30 L240 36 L280 16 L320 22"
            stroke="var(--flame-400)"
            strokeOpacity=".35"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center bg-surface/60">
          <span className="text-sm font-bold text-muted">
            {copy.lockedBadge}
          </span>
        </div>
      </div>
      <Link
        href={trendPanelUpgradeHref(reason, locale)}
        prefetch={false}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white transition-transform active:scale-[0.97]"
      >
        {reason === "signed_out" ? copy.loginToView : copy.upgradeToView}
        <span aria-hidden>&nbsp;→</span>
      </Link>
    </div>
  );
}

function TrendChart({
  series,
  summaries,
  metric,
  onMetric,
  copy,
  locale,
}: {
  series: Point[];
  summaries: TrendChangeSummary[];
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
  copy: PremiumCopy["trend"];
  locale: Locale;
}) {
  const gradientId = useId();

  if (series.length < 2) {
    return <p className="mt-3 text-sm text-muted">{copy.noData}</p>;
  }

  const values = series.map((p) => Number(p[metric]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const W = 320;
  const H = 96;
  const stepX = W / (series.length - 1);
  const toY = (v: number) => H - 8 - ((v - min) / span) * (H - 20);

  const line = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)} ${toY(v).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta =
    first === 0 ? (last > 0 ? 100 : 0) : ((last - first) / first) * 100;
  const metrics = trendMetrics(copy);
  const label = metrics.find((item) => item.key === metric)?.label ?? "";
  const number = new Intl.NumberFormat(toBcp47(locale));
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(toBcp47(locale), {
      month: "short",
      day: "numeric",
    }).format(new Date(`${value}T12:00:00Z`));
  const start = formatDate(series[0].date);
  const end = formatDate(series[series.length - 1].date);

  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map((summary) => {
          const reason = summary.direction === "up"
            ? copy.observedUp
            : summary.direction === "down"
              ? copy.observedDown
              : summary.direction === "flat"
                ? copy.observedFlat
                : copy.observedInsufficient;
          const confidence = summary.confidence === "high"
            ? copy.confidenceHigh
            : summary.confidence === "medium"
              ? copy.confidenceMedium
              : summary.confidence === "low"
                ? copy.confidenceLow
                : copy.confidenceInsufficient;
          return (
            <section key={summary.days} className="rounded-xl border border-border bg-surface-2 p-3">
              <h3 className="text-sm font-bold">{copy.windowSummary(summary.days)}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{reason}</p>
              {summary.direction !== "insufficient" && summary.startScore !== null && summary.endScore !== null && (
                <p className="mt-2 text-xs font-semibold text-accent-text">
                  <span className="block">{copy.observedBasis}</span>
                  {copy.observedEvidence(
                    summary.startScore,
                    summary.endScore,
                    summary.views,
                    summary.reactions,
                    summary.saves,
                  )}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li>{confidence}</li>
                <li>{copy.sampleCoverage(summary.sampleCount, summary.days, summary.coveragePercent)}</li>
                <li>
                  {summary.lastObservedAt
                    ? copy.lastObserved(formatDate(summary.lastObservedAt))
                    : copy.lastObservedUnavailable}
                </li>
              </ul>
            </section>
          );
        })}
      </div>

      {/* 지표 전환 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onMetric(m.key)}
            aria-pressed={metric === m.key}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
              metric === m.key
                ? "border-accent-strong bg-accent-strong text-white"
                : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 요약 */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 py-2.5">
          <dt className="text-xs text-muted">{copy.current}</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums">
            {number.format(last)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 py-2.5">
          <dt className="text-xs text-muted">{copy.periodHigh}</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums">
            {number.format(max)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 py-2.5">
          <dt className="text-xs text-muted">{copy.change}</dt>
          <dd
            className={`mt-0.5 text-base font-bold tabular-nums ${
              delta > 0
                ? "text-life-rising-text"
                : delta < 0
                  ? "text-life-cooling-text"
                  : ""
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(0)}%
          </dd>
        </div>
      </dl>

      {/* 곡선 */}
      <figure className="mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-28 w-full"
          role="img"
          aria-label={copy.chartLabel(label, start, end, last, max)}
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <figcaption className="mt-2 flex justify-between text-xs tabular-nums text-muted">
          <span>{start}</span>
          <span>{end}</span>
        </figcaption>
      </figure>
    </div>
  );
}
