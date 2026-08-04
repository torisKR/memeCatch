"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
  shares: number;
  saves: number;
};

type Payload =
  | { locked: true; reason: "signed_out" | "not_premium" }
  | { locked: false; series: Point[] };

const METRICS = [
  { key: "trend_score", label: "트렌드 점수" },
  { key: "views", label: "조회" },
  { key: "reactions", label: "반응" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

export function MemeTrendPanel({ memeId }: { memeId: string }) {
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
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
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
      { rootMargin: "200px 0px" }
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
          트렌드 추이
        </h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text">
          Plus
        </span>
      </div>

      {failed && (
        <p className="mt-3 text-sm text-muted">
          추이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {!failed && data === null && (
        <div
          aria-hidden
          className="mt-4 h-40 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
        />
      )}

      {data?.locked && <LockedTeaser reason={data.reason} />}

      {data && !data.locked && (
        <TrendChart series={data.series} metric={metric} onMetric={setMetric} />
      )}
    </section>
  );
}

function LockedTeaser({ reason }: { reason: "signed_out" | "not_premium" }) {
  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-muted">
        이 밈이 며칠에 걸쳐 어떻게 퍼졌는지 — 조회·반응·트렌드 점수의 일별
        추이를 Plus에서 볼 수 있어요. 지금 뜨는 중인지, 이미 지나갔는지 한눈에
        구분됩니다.
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
          <span className="text-sm font-bold text-muted">Plus 전용</span>
        </div>
      </div>
      <Link
        href={reason === "signed_out" ? "/login?next=/pricing" : "/pricing"}
        prefetch={false}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white transition-transform active:scale-[0.97]"
      >
        {reason === "signed_out" ? "로그인하고 보기" : "Plus로 추이 보기"}
        <span aria-hidden>&nbsp;→</span>
      </Link>
    </div>
  );
}

function TrendChart({
  series,
  metric,
  onMetric,
}: {
  series: Point[];
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
}) {
  if (series.length < 2) {
    return (
      <p className="mt-3 text-sm text-muted">
        아직 추이를 그릴 만큼 데이터가 쌓이지 않았어요. 하루 한 번 기록되니 며칠
        뒤 다시 확인해 주세요.
      </p>
    );
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
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = first === 0 ? (last > 0 ? 100 : 0) : ((last - first) / first) * 100;
  const label = METRICS.find((m) => m.key === metric)?.label ?? "";

  return (
    <div className="mt-3">
      {/* 지표 전환 */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
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
          <dt className="text-xs text-muted">현재</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums">
            {last.toLocaleString("ko-KR")}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 py-2.5">
          <dt className="text-xs text-muted">기간 최고</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums">
            {max.toLocaleString("ko-KR")}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 py-2.5">
          <dt className="text-xs text-muted">변화</dt>
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
          aria-label={`${label} 추이 — ${series[0].date}부터 ${series[series.length - 1].date}까지, 현재 ${last}, 최고 ${max}`}
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#trend-fill)" />
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
          <span>{series[0].date}</span>
          <span>{series[series.length - 1].date}</span>
        </figcaption>
      </figure>
    </div>
  );
}
