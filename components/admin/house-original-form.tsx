"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHouseOriginal } from "@/lib/actions/admin";
import { CATEGORIES, DIFFICULTY, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  SAFETY_OPTIONS,
  USAGE_CONTEXT_KEYS,
} from "./constants";
import { SafetySelect } from "./safety-select";

type UsageContextState = Record<(typeof USAGE_CONTEXT_KEYS)[number], SafetyLevel>;

export function HouseOriginalForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>("yellow");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("phrase");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>("normal");
  const [originYear, setOriginYear] = useState("");
  const [usageContext, setUsageContext] = useState<UsageContextState>({
    work: "yellow",
    friends: "green",
    family: "yellow",
    sns: "yellow",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const year = originYear.trim() ? Number(originYear) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
      setError("제작 연도는 1980~2100 사이 숫자로 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await createHouseOriginal({
        title,
        summary,
        description,
        origin,
        safetyLevel,
        category,
        difficulty,
        originYear: year,
        usageContext,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/memes/${res.data?.memeId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <p className="rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed">
        밈캐치가 직접 만든 사전 항목만 등록합니다. 인터넷 밈을 카탈로그로 옮기거나 AI 초안을
        자동 게시하지 않습니다. 저장하면 <strong>대기(pending)</strong>만 만들어지고, 사실 확인과
        권리 확인은 따로 진행합니다.
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-safety-red-bg p-3 text-base text-safety-red">
          {error}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-base font-medium">제목</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">한 줄 요약</span>
        <input
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">설명</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">어떻게 만들었나요?</span>
        <textarea
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          rows={4}
          placeholder="밈캐치가 이 형식을 만든 경위. 인터넷 원출처나 연도를 지어내지 마세요."
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <SafetySelect
          label="신호등"
          value={safetyLevel}
          options={SAFETY_OPTIONS}
          onChange={setSafetyLevel}
        />
        <label className="block">
          <span className="mb-1 block text-base font-medium">분류</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORY_OPTIONS)[number])}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].user}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">난이도</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as (typeof DIFFICULTY_OPTIONS)[number])}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          >
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY[d].user}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block sm:max-w-xs">
        <span className="mb-1 block text-base font-medium">제작 연도 (선택)</span>
        <input
          inputMode="numeric"
          value={originYear}
          onChange={(e) => setOriginYear(e.target.value)}
          placeholder="2026"
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-base font-medium">상황별 신호등</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {USAGE_CONTEXT_KEYS.map((key) => (
            <SafetySelect
              key={key}
              label={USAGE_CONTEXTS[key]}
              value={usageContext[key]}
              options={SAFETY_OPTIONS}
              onChange={(level) => setUsageContext((prev) => ({ ...prev, [key]: level }))}
            />
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : "대기로 저장"}
      </button>
    </form>
  );
}
