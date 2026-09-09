import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Clock3,
  LibraryBig,
} from "lucide-react";
import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";

export function SafetySignalSection() {
  const levels = Object.entries(SAFETY_LEVELS) as [
    SafetyLevel,
    (typeof SAFETY_LEVELS)[SafetyLevel],
  ][];

  return (
    <section
      aria-labelledby="sec-safety"
      className="rounded-2xl border border-border bg-surface px-5 py-8 shadow-sm sm:px-8 sm:py-10"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.65fr)] lg:items-center">
        <div>
          <p className="text-sm font-bold text-accent-text">사용 전 맥락 확인</p>
          <h2 id="sec-safety" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            지금 써도 될까요?
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            뜻뿐 아니라 분위기와 유행 시점까지 검토해 네 단계로 알려드려요.
          </p>
          <Link
            href="/editorial"
            className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-text transition-colors duration-200 hover:text-accent motion-reduce:transition-none"
          >
            판정 기준 보기 <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {levels.map(([key, meta]) => (
            <li key={key} className="rounded-xl bg-surface-2 p-4">
              <span
                aria-hidden
                className="grid size-10 place-items-center rounded-xl text-base font-bold"
                style={{
                  color: `var(--${meta.token})`,
                  background: `var(--${meta.token}-bg)`,
                }}
              >
                {meta.icon}
              </span>
              <span className="mt-3 block font-bold text-foreground">{meta.user}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const PATHS = [
  {
    title: "테마별 모음",
    description: "최신·시대·장르별로 편집한 밈 목록",
    href: "/collections",
    icon: LibraryBig,
  },
  {
    title: "시대별 연표",
    description: "1990년대부터 지금까지 밈의 흐름",
    href: "/timeline",
    icon: Clock3,
  },
  {
    title: "밈 입문 코스",
    description: "처음 보는 사람을 위한 필수 밈부터",
    href: "/collections/beginner",
    icon: BookOpenText,
  },
] as const;

export function HomePathwaysSection() {
  return (
    <section aria-labelledby="sec-pathways">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-accent-text">더 깊이 둘러보기</p>
          <h2 id="sec-pathways" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            원하는 방식으로 시작하세요
          </h2>
        </div>
        <Link
          href="/explore"
          className="hidden min-h-11 items-center gap-1 text-sm font-semibold text-accent-text transition-colors duration-200 hover:text-accent motion-reduce:transition-none sm:inline-flex"
        >
          전체 탐색 <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <ol className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-2">
        {PATHS.map((item, index) => {
          const Icon = item.icon;

          return (
            <li key={item.href} className={index === 0 ? "lg:row-span-2" : ""}>
              <Link
                href={item.href}
                prefetch={item.href === "/timeline" ? false : undefined}
                className={`group flex h-full min-h-40 flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none sm:p-6 ${
                  index === 0 ? "lg:min-h-80 lg:p-8" : ""
                }`}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-text">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-5 text-muted transition-colors duration-200 group-hover:text-accent-text motion-reduce:transition-none"
                  />
                </span>
                <span className="mt-8">
                  <span className={`block font-extrabold tracking-tight ${index === 0 ? "text-2xl lg:text-3xl" : "text-xl"}`}>
                    {item.title}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function SubmitCtaSection() {
  return (
    <section
      aria-labelledby="sec-submit"
      className="rounded-2xl border border-border bg-surface-2 px-5 py-8 sm:px-8 sm:py-10"
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 id="sec-submit" className="text-xl font-extrabold sm:text-2xl">
            새로운 밈을 가장 먼저 발견했나요?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            사실과 저작권을 검수한 뒤 출처 링크와 함께 사전에 기록합니다.
          </p>
        </div>
        <Link
          href="/submit"
          className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none"
        >
          밈 제보하기 <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
