import Link from "next/link";
import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";
import { EXPLORE_QUICK_LINKS } from "@/lib/quick-links";
import { COLLECTIONS } from "@/lib/collections";

/**
 * 홈 랜딩 섹션 모음 (2026-07 전면 리뉴얼) — 전부 서버 컴포넌트.
 * D. 사용 안전 신호 설명  E. 카테고리 벤토  G. 시대별 아카이브  I. 제보 CTA
 * 실데이터/실쿼리만 연결하고 가짜 수치는 넣지 않는다(리뉴얼 지침 §10).
 */

/* ── D. 사용 안전 신호 — 밈캐치 시그니처 설명 섹션 ─────────────── */

const SAFETY_EXAMPLES: { q: string; a: string; level: SafetyLevel }[] = [
  { q: "회사 단톡에서 써도 될까?", a: "초록 신호면 안심하고, 노랑이면 분위기부터 살펴요.", level: "green" },
  { q: "이미 한물간 밈일까?", a: "회색 신호는 유행이 지났다는 뜻 — 아는 척은 위험해요.", level: "gray" },
  { q: "친구끼리는 괜찮을까?", a: "빨강 신호는 어디서든 피하는 게 좋아요.", level: "red" },
];

export function SafetySignalSection() {
  const levels = Object.entries(SAFETY_LEVELS) as [
    SafetyLevel,
    (typeof SAFETY_LEVELS)[SafetyLevel],
  ][];
  return (
    <section aria-labelledby="sec-safety" className="mt-10">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
        Usage Signal
      </p>
      <h2 id="sec-safety" className="mt-1.5 text-xl font-bold">
        지금 써도 되는지, 신호 하나로
      </h2>
      <p className="mt-1 text-sm text-muted">
        모든 밈에 사용 안전 신호가 붙어요 — 나무위키도 AI도 알려주지 않는 밈캐치의 기준.
      </p>

      {/* 신호 바 — 4단계를 하나의 시그널 바 위 orb로 표현(전형적 신호등 도상 회피) */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {levels.map(([key, meta]) => (
          <div
            key={key}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: `var(--${meta.token})` }}
            />
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full text-base font-bold"
              style={{
                color: `var(--${meta.token})`,
                background: `var(--${meta.token}-bg)`,
              }}
            >
              {meta.icon}
            </span>
            <p className="mt-2.5 font-bold">{meta.user}</p>
          </div>
        ))}
      </div>

      {/* 상황 예시 — "이 질문에 답한다"는 경험을 보여주는 정적 카드 */}
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {SAFETY_EXAMPLES.map((ex) => {
          const meta = SAFETY_LEVELS[ex.level];
          return (
            <li
              key={ex.q}
              className="rounded-2xl border border-border bg-surface-2/60 p-4 text-sm"
            >
              <p className="font-semibold">“{ex.q}”</p>
              <p className="mt-1.5 text-muted">
                <span aria-hidden className="mr-1" style={{ color: `var(--${meta.token})` }}>
                  {meta.icon}
                </span>
                {ex.a}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── E. 카테고리 벤토 — 전부 실제 /explore 필터 쿼리로 연결 ────── */

export function CategoryBentoSection() {
  return (
    <section aria-labelledby="sec-bento" className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <h2 id="sec-bento" className="text-xl font-bold">
          어디서부터 볼까요
        </h2>
        <Link
          href="/explore"
          className="flex min-h-11 shrink-0 items-center rounded-md py-1 text-sm font-medium text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          전체 탐색 <span aria-hidden>→</span>
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EXPLORE_QUICK_LINKS.map((item) => (
          <li key={item.key} className={item.featured ? "col-span-2" : ""}>
            <Link
              href={item.href}
              className="hover-glow-flame flex h-full min-h-24 flex-col justify-between gap-2 rounded-2xl border border-border bg-surface p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
            >
              <span className="font-bold leading-snug">{item.title}</span>
              <span className="flex items-center justify-between gap-2 text-sm text-muted">
                <span className="truncate">{item.description}</span>
                <span aria-hidden className="shrink-0 text-accent">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* 테마 허브(SEO 내부 링크) — 컴팩트 칩 줄로 유지 */}
      <nav aria-label="테마별 밈 모음" className="mt-4">
        <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {COLLECTIONS.map((c) => (
            <li key={c.slug} className="shrink-0 snap-start">
              <Link
                href={`/collections/${c.slug}`}
                className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

/* ── G. 시대별 아카이브 — /timeline 진입 스트립 ────────────────── */

const ERAS: { key: string; label: string; desc: string; href: string }[] = [
  { key: "1990s", label: "1990s", desc: "하이루·PC통신·1세대 유행어", href: "/timeline" },
  { key: "2000s", label: "2000s", desc: "싸이월드·엽기·플래시 밈", href: "/explore?year=2000s" },
  { key: "2010s", label: "2010s", desc: "짤방 전성기·SNS 유행어", href: "/explore?year=2010s" },
  { key: "2020s", label: "2020s", desc: "숏폼·챌린지·밈의 초고속화", href: "/explore?year=2020s" },
];

export function EraArchiveSection() {
  return (
    <section aria-labelledby="sec-era" className="mt-10">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
        K-Meme Archive
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <h2 id="sec-era" className="text-xl font-bold">
          시대별로 흐름 따라가기
        </h2>
        <Link
          href="/timeline"
          prefetch={false}
          className="flex min-h-11 shrink-0 items-center rounded-md py-1 text-sm font-medium text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          전체 연표 <span aria-hidden>→</span>
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ERAS.map((era, i) => (
          <li key={era.key}>
            <Link
              href={era.href}
              prefetch={false}
              className="hover-glow-flame relative flex h-full flex-col gap-1.5 overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
            >
              {/* 연대 눈금 — 아카이브 타임라인 모티프(장식) */}
              <span
                aria-hidden
                className="absolute inset-x-4 top-3 flex items-center gap-1 opacity-60"
              >
                <span className="h-px flex-1 bg-border" />
                {Array.from({ length: 4 }, (_, d) => (
                  <span
                    key={d}
                    className={`h-1.5 w-px ${d === i ? "bg-accent" : "bg-border"}`}
                  />
                ))}
              </span>
              <span className="mt-4 font-mono text-lg font-bold tracking-tight text-accent">
                {era.label}
              </span>
              <span className="text-sm leading-relaxed text-muted">{era.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── I. 제보 CTA ───────────────────────────────────────────────── */

export function SubmitCtaSection() {
  return (
    <section
      aria-labelledby="sec-submit"
      className="relative mt-12 overflow-hidden rounded-3xl border border-accent/25 bg-accent-soft/50 p-6 sm:p-8"
    >
      <h2 id="sec-submit" className="text-xl font-bold">
        새로운 밈을 가장 먼저 발견했나요?
      </h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
        제보해 주시면 운영자가 사실·저작권을 검수한 뒤 사전에 기록해요. 원본은 저장하지
        않고 출처 링크·임베드로만 보존합니다.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/submit"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          밈 제보하기 <span aria-hidden>→</span>
        </Link>
        <span className="text-sm text-muted">실시간 중복 검사로 바로 확인돼요</span>
      </div>
    </section>
  );
}
