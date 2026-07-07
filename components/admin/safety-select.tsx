"use client";

import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";

/** 신호등 셀렉트 — 색+아이콘+텍스트 병행 (색약 대응) */
export function SafetySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: SafetyLevel;
  options: SafetyLevel[];
  onChange: (v: SafetyLevel) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-base font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="shrink-0 text-lg"
          style={{ color: `var(--safety-${value})` }}
        >
          {SAFETY_LEVELS[value].icon}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SafetyLevel)}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {SAFETY_LEVELS[o].icon} {SAFETY_LEVELS[o].admin} ({SAFETY_LEVELS[o].user})
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
