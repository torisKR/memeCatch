import type { ReactNode } from "react";

type SignalTone = "waiting" | "missing" | "error";

const SIGNAL: Record<SignalTone, { index: number; color: string }> = {
  waiting: { index: 1, color: "var(--safety-yellow)" },
  missing: { index: 0, color: "var(--accent)" },
  error: { index: 2, color: "var(--safety-red)" },
};

/** 빈 상태와 오류 상태에서도 밈캐치의 신호등 언어를 유지하는 공통 패널. */
export function StatusPanel({
  label,
  title,
  description,
  tone = "waiting",
  role,
  actions,
  className = "",
}: {
  label: string;
  title: string;
  description: string;
  tone?: SignalTone;
  role?: "alert" | "status";
  actions?: ReactNode;
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
