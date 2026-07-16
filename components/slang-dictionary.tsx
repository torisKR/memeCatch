"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SafetyBadge } from "@/components/safety-badge";
import type { SafetyLevel } from "@/lib/labels";

/**
 * /slang 전용 사전 뷰.
 * 페이지 문서는 ISR 정적 셸로 유지해야 하므로(?era=는 캐시 키가 아님) 서버에서
 * searchParams를 읽지 않는다. 대신 네 연대 패널을 전부 정적 HTML에 싣고,
 * 활성 탭만 useSearchParams(Suspense 내부)로 URL과 동기화한다.
 * - 정적 셸(Suspense fallback): <SlangDictionary active="now">
 * - 하이드레이션 후: <SlangDictionaryFromQuery>가 ?era= 값으로 패널을 전환
 * 비활성 패널은 hidden 속성으로만 감춰 크롤러에는 전체 표제어가 노출된다.
 */

export type SlangEraKey = "now" | "2010s" | "2000s" | "1990s" | "risky";

export type SlangTerm = {
  href: string;
  title: string;
  summary: string;
  safety: SafetyLevel;
  year: number | null;
};

export type SlangEra = {
  key: SlangEraKey;
  label: string;
  /** 탭 보조 연도 표기 (예: "2020~") — 위험 패널처럼 없으면 빈 문자열 */
  range: string;
  /** 빈 문자열이면 "탐색에서 더 보기" 링크를 감춘다(탐색에 대응 필터 없음) */
  exploreHref: string;
  /** 패널 상단 안내 한 줄(위험 패널 등) — 없으면 미노출 */
  description?: string;
  terms: SlangTerm[];
};

const ERA_KEYS: readonly SlangEraKey[] = [
  "now",
  "2010s",
  "2000s",
  "1990s",
  "risky",
];

function parseEra(value: string | null): SlangEraKey {
  return (ERA_KEYS as readonly string[]).includes(value ?? "")
    ? (value as SlangEraKey)
    : "now";
}

/** ?era= 값과 활성 탭을 동기화하는 진입점 — 반드시 Suspense 안에서 렌더 */
export function SlangDictionaryFromQuery({ eras }: { eras: SlangEra[] }) {
  const era = parseEra(useSearchParams().get("era"));
  // 알려진 키라도 이번 렌더의 패널 목록에 없으면(예: 위험 표제어 0건) 기본 탭으로
  const active = eras.some((e) => e.key === era) ? era : "now";
  return <SlangDictionary eras={eras} active={active} />;
}

/** 순수 뷰 — 정적 셸(fallback)과 클라이언트 동기화 뷰가 공유 */
export function SlangDictionary({
  eras,
  active = "now",
}: {
  eras: SlangEra[];
  active?: SlangEraKey;
}) {
  return (
    <div className="mt-6">
      <nav
        aria-label="연대 선택"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {eras.map((era) => {
          const current = era.key === active;
          return (
            <Link
              key={era.key}
              href={era.key === "now" ? "/slang" : `/slang?era=${era.key}`}
              scroll={false}
              aria-current={current ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97] ${
                current
                  ? "border-accent-strong bg-accent-strong text-white"
                  : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {era.label}
              {era.range && (
                <span
                  className={`text-xs font-medium tabular-nums ${
                    current ? "text-white/90" : ""
                  }`}
                >
                  {era.range}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {eras.map((era) => (
        <section
          key={era.key}
          hidden={era.key !== active}
          aria-labelledby={`slang-era-${era.key}`}
          className="mt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id={`slang-era-${era.key}`}
              className="text-xl font-bold tracking-tight"
            >
              {era.label} 유행어
            </h2>
            {era.terms.length > 0 && (
              <p className="shrink-0 text-sm text-muted">
                {era.key === "risky" ? "위험 우선" : "많이 본 순"} ·{" "}
                {era.terms.length}개
              </p>
            )}
          </div>

          {era.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {era.description}
            </p>
          )}

          {era.terms.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-lg font-bold">아직 채워지는 중이에요</p>
              <p className="mt-1.5 text-base text-muted">
                이 연대의 유행어가 검수를 통과하면 여기에 올라와요.
              </p>
            </div>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-x-10 lg:grid-cols-2">
              {era.terms.map((term) => (
                <li key={term.href} className="border-b border-border">
                  <Link
                    href={term.href}
                    prefetch={false}
                    className="group flex min-h-11 flex-col justify-center gap-0.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-bold leading-snug transition-colors group-hover:text-accent">
                        {term.title}
                      </span>
                      {term.year != null && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
                          {term.year}
                        </span>
                      )}
                      <SafetyBadge level={term.safety} />
                    </span>
                    <span className="truncate text-sm text-muted">
                      {term.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {era.exploreHref && (
            <Link
              href={era.exploreHref}
              prefetch={false}
              className="mt-5 inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-5 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97]"
            >
              탐색에서 더 보기 <span aria-hidden>→</span>
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}
