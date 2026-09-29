import { SafetyIcon } from "@/components/safety-icon";
import type { Locale } from "@/lib/i18n";
import type { SafetyLevel } from "@/lib/labels";
import {
  getSafetySignalCopy,
  SAFETY_SIGNAL_LEVELS,
} from "@/lib/safety-copy";

const TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

export function SafetySignalGuide({ locale = "ko" }: { locale?: Locale }) {
  const copy = getSafetySignalCopy(locale);

  return (
    <section
      aria-labelledby="safety-signal-guide-title"
      className="rounded-2xl border border-border bg-surface px-5 py-7 shadow-sm sm:px-7 sm:py-8"
    >
      <p className="text-sm font-bold text-accent-text">{copy.eyebrow}</p>
      <h2
        id="safety-signal-guide-title"
        className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl"
      >
        {copy.title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        {copy.description}
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SAFETY_SIGNAL_LEVELS.map((level) => {
          const item = copy.levels[level];

          return (
            <li key={level}>
              <details className="group h-full rounded-xl border border-border bg-surface-2 open:bg-surface">
                <summary
                  tabIndex={0}
                  className="cursor-pointer rounded-xl px-4 py-4 marker:text-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE[level]}`}
                    >
                      <SafetyIcon level={level} className="size-6" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-sm leading-snug text-muted">
                        {item.summary}
                      </span>
                    </span>
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted">
                  {item.detail}
                </p>
              </details>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted">
        {copy.disclaimer}
      </p>
    </section>
  );
}
