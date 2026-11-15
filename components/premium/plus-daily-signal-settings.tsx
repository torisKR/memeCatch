"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n-client";
import { LANGUAGE_NAMES, type Locale } from "@/lib/i18n";
import { DAILY_SIGNAL_COPY } from "@/lib/plus-daily-signal-copy";
import type { DailySignalLocale } from "@/lib/plus-daily-signal.server";

const DAILY_SIGNAL_LOCALES: readonly DailySignalLocale[] = ["ko", "en", "ja", "zh", "zh-tw"];

export function PlusDailySignalSettings({
  enabled: initialEnabled,
  preferredLocale: initialLocale,
}: {
  enabled: boolean;
  preferredLocale: DailySignalLocale;
}) {
  const { locale } = useLocale();
  const copy = DAILY_SIGNAL_COPY[locale];
  const [enabled, setEnabled] = useState(initialEnabled);
  const [preferredLocale, setPreferredLocale] = useState(initialLocale);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);

  async function save(nextEnabled: boolean, nextLocale: DailySignalLocale) {
    const previous = { enabled, preferredLocale };
    setEnabled(nextEnabled);
    setPreferredLocale(nextLocale);
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/plus/daily-signal/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, locale: nextLocale }),
      });
      if (!response.ok) throw new Error("preference_failed");
      setStatus("saved");
    } catch {
      setEnabled(previous.enabled);
      setPreferredLocale(previous.preferredLocale);
      setStatus("failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="plus-daily-signal-title"
      data-daily-signal-enabled={enabled ? "true" : "false"}
      className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">PLUS SIGNAL</p>
          <h2 id="plus-daily-signal-title" className="mt-1 text-lg font-bold">{copy.settingsTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.settingsBody}</p>
        </div>
        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(event) => void save(event.target.checked, preferredLocale)}
            className="size-5 accent-(--accent-strong)"
          />
          {copy.enabledLabel}
        </label>
      </div>
      <label className="mt-4 flex max-w-sm flex-col gap-2 text-sm font-semibold">
        <span>{copy.localeLabel}</span>
        <select
          value={preferredLocale}
          disabled={saving}
          onChange={(event) => void save(enabled, event.target.value as DailySignalLocale)}
          className="min-h-11 rounded-xl border border-border bg-surface px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {DAILY_SIGNAL_LOCALES.map((option) => (
            <option key={option} value={option}>
              {LANGUAGE_NAMES[option as Locale]}
            </option>
          ))}
        </select>
      </label>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">
        {status === "saved" ? copy.saved : status === "failed" ? copy.failed : ""}
      </p>
    </section>
  );
}
