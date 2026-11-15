"use client";

import { useState } from "react";
import type { PremiumCopy } from "@/lib/i18n-premium";

type Feature = PremiumCopy["pricing"]["features"][number];

export function PlusFeatures({
  features,
  heading,
}: {
  features: ReadonlyArray<Feature>;
  heading: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="plus-features-title">
      <h2
        id="plus-features-title"
        className="text-center text-2xl font-black tracking-tight"
      >
        {heading}
      </h2>
      <ul className="mt-6 space-y-3">
        {features.map((feature, index) => {
          const isOpen = openIndex === index;
          const panelId = `plus-feature-panel-${index}`;
          const buttonId = `plus-feature-button-${index}`;
          return (
            <li
              key={feature.label}
              className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors data-[open=true]:border-accent/40"
              data-open={isOpen}
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-black text-accent-text shadow-[0_0_0_1px_var(--flame-500),0_0_10px_-2px_var(--flame-500)]"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{feature.label}</span>
                    <span className="block text-sm text-accent-text">
                      {feature.plus}
                    </span>
                  </span>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="size-5 shrink-0 text-muted transition-transform duration-200 data-[open=true]:rotate-180"
                    data-open={isOpen}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="instrument-grid px-5 pb-4 pl-14 text-sm leading-relaxed text-muted"
              >
                {feature.detail}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
