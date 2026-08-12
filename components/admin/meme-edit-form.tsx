"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateKoreanReviewDraft, updateMeme } from "@/lib/actions/admin";
import { CATEGORIES, DIFFICULTY, LIFECYCLE_STATUS, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  LIFECYCLE_OPTIONS,
  SAFETY_OPTIONS,
  SENTIMENT_ADMIN_LABELS,
  SENTIMENT_OPTIONS,
  USAGE_CONTEXT_KEYS,
} from "./constants";
import { SafetySelect } from "./safety-select";

type UsageContextState = Record<(typeof USAGE_CONTEXT_KEYS)[number], SafetyLevel>;

type Initial = {
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string;
  caution: string;
  aliases: string[];
  safetyLevel: SafetyLevel;
  lifecycleStatus: (typeof LIFECYCLE_OPTIONS)[number];
  category: (typeof CATEGORY_OPTIONS)[number];
  difficulty: (typeof DIFFICULTY_OPTIONS)[number];
  sentiment: (typeof SENTIMENT_OPTIONS)[number];
  originYear: number | null;
  usageContext: UsageContextState;
};

export function MemeEditForm({
  memeId,
  initial,
  hasOpenAiReviewKey,
}: {
  memeId: string;
  initial: Initial;
  hasOpenAiReviewKey: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [form, setForm] = useState({
    ...initial,
    aliases: initial.aliases.join(", "),
    originYear: initial.originYear?.toString() ?? "",
  });
  const [usageContext, setUsageContext] = useState<UsageContextState>(initial.usageContext);
  const [translating, setTranslating] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const year = form.originYear.trim() ? Number(form.originYear) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
      setMessage({ kind: "error", text: "연도는 1980~2100 사이 숫자로 입력해 주세요." });
      return;
    }
    startTransition(async () => {
      const res = await updateMeme({
        memeId,
        title: form.title,
        summary: form.summary,
        description: form.description,
        origin: form.origin,
        usageNote: form.usageNote,
        caution: form.caution,
        aliases: form.aliases.split(",").map((a) => a.trim()).filter(Boolean),
        safetyLevel: form.safetyLevel,
        lifecycleStatus: form.lifecycleStatus,
        category: form.category,
        difficulty: form.difficulty,
        sentiment: form.sentiment,
        originYear: year,
        usageContext,
      });
      if (!res.ok) setMessage({ kind: "error", text: res.error });
      else {
        setMessage({
          kind: "success",
          text: res.data?.safetyReviewQueued
            ? "내용을 저장하고 안전 등급 변경은 Radar 검수 대기열에 추가했어요."
            : "저장했어요.",
        });
        router.refresh();
      }
    });
  }

  async function translateForReview() {
    setMessage(null);
    setTranslating(true);
    try {
      const res = await generateKoreanReviewDraft(memeId);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      const draft = res.data!;
      setForm((prev) => ({
        ...prev,
        title: draft.title,
        summary: draft.summary,
        description: draft.description,
        origin: draft.origin,
        usageNote: draft.usage_note,
        caution: draft.caution,
      }));
      setMessage({
        kind: "success",
        text:
          draft.review_basis === "korean_wikipedia"
            ? "한국어 위키백과 자료로 검수 초안을 채웠어요. 항목 일치 여부와 사실관계를 확인한 뒤 저장해 주세요."
            : "한국어 검수 초안을 채웠어요. 사실관계와 고유명사를 확인한 뒤 저장해 주세요.",
      });
    } finally {
      setTranslating(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none";
  const selectCls = `${inputCls} min-h-11`;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">밈 정보 편집</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            영문·혼합 언어 항목은 한국어 초안을 만든 뒤 검토해서 저장할 수 있어요.
          </p>
        </div>
        <span
          title={
            hasOpenAiReviewKey
              ? "GPT-5.6 Sol high가 영문·혼합 언어 내용을 한국어 검수 초안으로 정리해요."
              : "OPENAI_API_KEY를 설정하면 GPT-5.6 Sol high 검수 초안을 사용할 수 있어요."
          }
        >
          <button
            type="button"
            onClick={translateForReview}
            disabled={pending || translating || !hasOpenAiReviewKey}
            className="min-h-11 rounded-lg border border-accent bg-accent/10 px-4 text-sm font-semibold text-accent-text transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {translating ? "GPT 검수 중…" : "GPT-5.6 Sol high로 검수 초안"}
          </button>
        </span>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-base ${
            message.kind === "error"
              ? "bg-safety-red-bg text-safety-red"
              : "bg-safety-green-bg text-safety-green"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-base font-medium">제목</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} required className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">별칭 (쉼표로 구분)</span>
          <input value={form.aliases} onChange={(e) => set("aliases", e.target.value)} className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-base font-medium">한 줄 요약</span>
        <input value={form.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">설명</span>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={6}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">유래</span>
        <textarea value={form.origin} onChange={(e) => set("origin", e.target.value)} rows={4} className={inputCls} />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-base font-medium">사용 팁 (usage_note)</span>
          <textarea
            value={form.usageNote}
            onChange={(e) => set("usageNote", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">주의 문구 (caution)</span>
          <textarea
            value={form.caution}
            onChange={(e) => set("caution", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SafetySelect
          label="사용 안전 신호등"
          value={form.safetyLevel}
          options={SAFETY_OPTIONS}
          onChange={(v) => set("safetyLevel", v)}
        />
        <label className="block">
          <span className="mb-1 block text-base font-medium">생명주기</span>
          <select
            value={form.lifecycleStatus}
            onChange={(e) => set("lifecycleStatus", e.target.value as Initial["lifecycleStatus"])}
            className={selectCls}
          >
            {LIFECYCLE_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {LIFECYCLE_STATUS[l].user}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">카테고리</span>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value as Initial["category"])}
            className={selectCls}
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
            value={form.difficulty}
            onChange={(e) => set("difficulty", e.target.value as Initial["difficulty"])}
            className={selectCls}
          >
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY[d].user}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">감정 결</span>
          <select
            value={form.sentiment}
            onChange={(e) => set("sentiment", e.target.value as Initial["sentiment"])}
            className={selectCls}
          >
            {SENTIMENT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SENTIMENT_ADMIN_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">유행 시작 연도</span>
          <input
            value={form.originYear}
            onChange={(e) => set("originYear", e.target.value)}
            inputMode="numeric"
            placeholder="예: 2025"
            className={inputCls}
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-medium">사용 맥락별 신호등 (4컨텍스트)</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USAGE_CONTEXT_KEYS.map((k) => (
            <SafetySelect
              key={k}
              label={USAGE_CONTEXTS[k]}
              value={usageContext[k]}
              options={SAFETY_OPTIONS}
              onChange={(v) => setUsageContext((prev) => ({ ...prev, [k]: v }))}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
