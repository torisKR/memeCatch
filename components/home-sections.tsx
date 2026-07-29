import Link from "next/link";
import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";

/** 카드 묶음 대신 하나의 연속된 레일로 밈캐치의 안전 판정을 설명한다. */
export function SafetySignalSection() {
  const levels = Object.entries(SAFETY_LEVELS) as [
    SafetyLevel,
    (typeof SAFETY_LEVELS)[SafetyLevel],
  ][];

  return (
    <section aria-labelledby="sec-safety" className="border-y border-border py-8 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.65fr)] lg:items-center">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            Usage signal
          </p>
          <h2 id="sec-safety" className="mt-1.5 text-2xl font-extrabold tracking-tight">
            지금 써도 될까요?
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            뜻뿐 아니라 분위기와 유행 시점까지 검토해 네 단계로 알려드려요.
          </p>
          <Link
            href="/editorial"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-accent"
          >
            판정 기준 보기
          </Link>
        </div>

        <ol className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-4">
          {levels.map(([key, meta], index) => (
            <li
              key={key}
              className="relative flex items-center gap-3 border-b border-border bg-surface px-4 py-4 last:border-b-0 sm:block sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-full text-base font-bold"
                style={{
                  color: `var(--${meta.token})`,
                  background: `var(--${meta.token}-bg)`,
                }}
              >
                {meta.icon}
              </span>
              <span className="min-w-0 sm:mt-3 sm:block">
                <span className="block font-mono text-[10px] text-muted">0{index + 1}</span>
                <span className="block font-bold">{meta.user}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const PATHS = [
  {
    index: "01",
    eyebrow: "CURATED",
    title: "테마별 모음",
    description: "최신·시대·장르별로 편집한 밈 목록",
    href: "/collections",
  },
  {
    index: "02",
    eyebrow: "ARCHIVE",
    title: "시대별 연표",
    description: "1990년대부터 지금까지 밈의 흐름",
    href: "/timeline",
  },
  {
    index: "03",
    eyebrow: "START HERE",
    title: "밈 입문 코스",
    description: "처음 보는 사람을 위한 필수 밈부터",
    href: "/collections/beginner",
  },
] as const;

/** 홈에서는 목적지만 제시하고, 실제 콘텐츠 묶음은 각 전용 페이지가 맡는다. */
export function HomePathwaysSection() {
  return (
    <section aria-labelledby="sec-pathways" className="py-10 sm:py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            Browse by intent
          </p>
          <h2 id="sec-pathways" className="mt-1.5 text-2xl font-extrabold tracking-tight">
            원하는 방식으로 시작하세요
          </h2>
        </div>
        <Link
          href="/explore"
          className="hidden min-h-11 items-center text-sm font-semibold text-muted transition-colors hover:text-accent sm:inline-flex"
        >
          전체 탐색 <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>

      <ol className="mt-6 grid border-y border-border lg:grid-cols-3">
        {PATHS.map((item, index) => (
          <li key={item.href} className="border-b border-border last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
            <Link
              href={item.href}
              prefetch={item.href === "/timeline" ? false : undefined}
              className={`group flex min-h-36 flex-col justify-between gap-6 px-1 py-5 transition-colors hover:text-accent lg:px-5 ${
                index === 0 ? "lg:pl-1" : ""
              }`}
            >
              <span className="flex items-center justify-between gap-3 font-mono text-[11px] font-semibold tracking-[0.14em] text-muted">
                <span>{item.eyebrow}</span>
                <span>{item.index}</span>
              </span>
              <span>
                <span className="flex items-center justify-between gap-3 text-xl font-extrabold text-foreground transition-colors group-hover:text-accent">
                  {item.title}
                  <span aria-hidden>↗</span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SubmitCtaSection() {
  return (
    <section aria-labelledby="sec-submit" className="border-t border-border py-10 sm:py-12">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="border-l-2 border-accent pl-4">
          <h2 id="sec-submit" className="text-xl font-extrabold">
            새로운 밈을 가장 먼저 발견했나요?
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            사실과 저작권을 검수한 뒤 출처 링크와 함께 사전에 기록합니다.
          </p>
        </div>
        <Link
          href="/submit"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none"
        >
          밈 제보하기 <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </section>
  );
}
