import type { ReactNode } from "react";

type SignalTone = "waiting" | "missing" | "error";

const SIGNAL: Record<SignalTone, { index: number; color: string }> = {
  waiting: { index: 1, color: "var(--safety-yellow)" },
  missing: { index: 0, color: "var(--accent)" },
  error: { index: 2, color: "var(--safety-red)" },
};

/* 톤별 브랜드 일러스트(docs/brand-assets.md §상태 일러스트) — 잉크 배경 원본을
   screen 블렌드 + 라디얼 마스크로 표면에 융화시킨다. */
const ART: Record<SignalTone, string> = {
  waiting: "/brand/state-waiting.webp",
  missing: "/brand/state-empty-search.webp",
  error: "/brand/state-error.webp",
};

/** 빈 상태와 오류 상태에서도 밈캐치의 신호등 언어를 유지하는 공통 패널. */
export function StatusPanel({
  label,
  title,
  description,
  tone = "waiting",
  role,
  actions,
  art = true,
  className = "",
}: {
  label: string;
  title: string;
  description: string;
  tone?: SignalTone;
  role?: "alert" | "status";
  actions?: ReactNode;
  /** 톤별 브랜드 일러스트 표시 여부 — 좁은 삽입 맥락에서는 끈다. */
  art?: boolean;
  className?: string;
}) {
  const signal = SIGNAL[tone];

  return (
    <div
      role={role}
      className={`relative overflow-hidden rounded-3xl border border-border bg-surface-2 px-6 py-7 text-center sm:px-8 sm:py-8 ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 52%)",
      }}
    >
      <div className="relative mx-auto max-w-md">
        {art && (
          <img
            src={ART[tone]}
            alt=""
            width={1024}
            height={768}
            loading="lazy"
            decoding="async"
            className="mx-auto mb-3 w-44 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-48"
          />
        )}
        <div className="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white">
          <span aria-hidden className="flex items-center gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: index === signal.index ? signal.color : "rgb(255 255 255 / 0.22)",
                }}
              />
            ))}
          </span>
          {label}
        </div>
        <p className="mt-4 text-xl font-extrabold tracking-tight">{title}</p>
        <p className="mt-1.5 text-base text-muted">{description}</p>
        {actions && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
