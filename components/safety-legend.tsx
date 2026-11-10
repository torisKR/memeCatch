import { ChevronDown } from "lucide-react";
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
      <p className="mt-3 max-w-2xl text-base leading-7 text-foreground">
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
                  className="cursor-pointer list-none rounded-xl px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
                >
                  <span className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE[level]}`}
                    >
                      <SafetyIcon level={level} className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-base leading-6 text-foreground">
                        {item.summary}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                        <ChevronDown
                          aria-hidden
                          className="size-4 transition-transform group-open:rotate-180"
                        />
                        <span className="group-open:hidden">{copy.expand}</span>
                        <span className="hidden group-open:!inline">{copy.collapse}</span>
                      </span>
                    </span>
                  </span>
                </summary>
                <p className="px-4 pb-4 text-base leading-7 text-foreground">
                  {item.detail}
                </p>
              </details>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 max-w-3xl text-base leading-7 text-foreground">
        {copy.disclaimer}
      </p>
    </section>
  );
}
