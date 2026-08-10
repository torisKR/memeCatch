"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveSubmission,
  claimSubmission,
  generateDraft,
  rejectSubmission,
  type RejectCategory,
} from "@/lib/actions/admin";
import { CATEGORIES, DIFFICULTY, SAFETY_LEVELS, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  SAFETY_OPTIONS,
  USAGE_CONTEXT_KEYS,
} from "./constants";
import { SafetySelect } from "./safety-select";

const REJECT_OPTIONS: RejectCategory[] = ["중복", "출처 부족", "저작권", "부적절"];

type UsageContextState = Record<(typeof USAGE_CONTEXT_KEYS)[number], SafetyLevel>;

export function SubmissionReview({
  submissionId,
  submissionName,
  submissionTags,
  status,
  claimedByMe,
  hasOpenAiReviewKey,
}: {
  submissionId: string;
  submissionName: string;
  submissionTags: string[];
  status: "pending" | "reviewing";
  claimedByMe: boolean;
  hasOpenAiReviewKey: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");

  // 승인 폼 상태
  const [title, setTitle] = useState(submissionName);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>("yellow");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("phrase");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>("normal");
  const [originYear, setOriginYear] = useState("");
  const [tags, setTags] = useState(submissionTags.join(", "));
  const [usageContext, setUsageContext] = useState<UsageContextState>({
    work: "yellow",
    friends: "green",
    family: "yellow",
    sns: "yellow",
  });
  const [drafting, setDrafting] = useState(false);

  // 반려 폼 상태
  const [rejectCategory, setRejectCategory] = useState<RejectCategory | "">("");
  const [rejectReason, setRejectReason] = useState("");

  function claim() {
    setMessage(null);
    startTransition(async () => {
      const res = await claimSubmission(submissionId);
      if (!res.ok) setMessage({ kind: "error", text: res.error });
      else router.refresh();
    });
  }

  async function draft() {
    setMessage(null);
    setDrafting(true);
    try {
      const res = await generateDraft(submissionId);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      const d = res.data!;
      setSummary(d.summary);
      setDescription(d.description);
      setOrigin(d.origin);
      setSafetyLevel(d.safety_level);
      setUsageContext(d.usage_context);
      setMode("approve");
      setMessage({ kind: "success", text: "GPT-5.6 Sol high 검수 초안을 채웠어요. 내용을 검토하고 수정해 주세요." });
    } finally {
      setDrafting(false);
    }
  }

  function approve(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const year = originYear.trim() ? Number(originYear) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
        setMessage({ kind: "error", text: "연도는 1980~2100 사이 숫자로 입력해 주세요." });
        return;
      }
      const res = await approveSubmission({
        submissionId,
        title,
        summary,
        description,
        origin,
        safetyLevel,
        category,
        difficulty,
        originYear: year,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        usageContext,
      });
      if (!res.ok) setMessage({ kind: "error", text: res.error });
      else router.push("/admin/submissions");
    });
  }

  function reject(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!rejectCategory) {
      setMessage({ kind: "error", text: "반려 사유 카테고리를 선택해 주세요." });
      return;
    }
    if (!rejectReason.trim()) {
      setMessage({ kind: "error", text: "반려 사유를 입력해 주세요." });
      return;
    }
    startTransition(async () => {
      const res = await rejectSubmission({
        submissionId,
        category: rejectCategory,
        reason: rejectReason,
      });
      if (!res.ok) setMessage({ kind: "error", text: res.error });
      else router.push("/admin/submissions");
    });
  }

  const busy = pending || drafting;
  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none";

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">검토 처리</h2>

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

      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "처리 중…" : "내가 검토하기 (claim)"}
          </button>
        )}
        <span title={hasOpenAiReviewKey ? undefined : "OPENAI_API_KEY 설정 필요"}>
          <button
            type="button"
            onClick={draft}
            disabled={busy || !hasOpenAiReviewKey}
            className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drafting ? "GPT 검수 중…" : "GPT-5.6 Sol high로 검수 초안"}
          </button>
        </span>
        <button
          type="button"
          onClick={() => setMode(mode === "approve" ? "idle" : "approve")}
          disabled={busy}
          className={`min-h-11 rounded-lg border px-4 text-base font-semibold disabled:opacity-50 ${
            mode === "approve"
              ? "border-safety-green bg-safety-green-bg text-safety-green"
              : "border-border bg-surface-2"
          }`}
        >
          승인 → 밈 생성
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "reject" ? "idle" : "reject")}
          disabled={busy}
          className={`min-h-11 rounded-lg border px-4 text-base font-semibold disabled:opacity-50 ${
            mode === "reject"
              ? "border-safety-red bg-safety-red-bg text-safety-red"
              : "border-border bg-surface-2"
          }`}
        >
          반려
        </button>
      </div>
      {status === "reviewing" && !claimedByMe && (
        <p className="text-base text-muted">다른 운영자가 검토 중인 제보예요.</p>
      )}

      {mode === "approve" && (
        <form onSubmit={approve} className="space-y-4 border-t border-border pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-base font-medium">제목</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-base font-medium">유행 시작 연도</span>
              <input
                value={originYear}
                onChange={(e) => setOriginYear(e.target.value)}
                inputMode="numeric"
                placeholder="예: 2025"
                className={inputCls}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-base font-medium">한 줄 요약</span>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} required className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-base font-medium">설명</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-base font-medium">유래</span>
            <textarea value={origin} onChange={(e) => setOrigin(e.target.value)} rows={3} className={inputCls} />
          </label>
          <div className="grid gap-4 lg:grid-cols-3">
            <SafetySelect
              label="사용 안전 신호등"
              value={safetyLevel}
              options={SAFETY_OPTIONS}
              onChange={setSafetyLevel}
            />
            <label className="block">
              <span className="mb-1 block text-base font-medium">카테고리</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className={`${inputCls} min-h-11`}
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
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                className={`${inputCls} min-h-11`}
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY[d].user}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 text-base font-medium">사용 맥락별 신호등</legend>
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
          <label className="block">
            <span className="mb-1 block text-base font-medium">태그 (쉼표로 구분)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
          </label>
          <p className="text-sm text-muted">
            승인하면 밈이 생성되고 검수 상태가 대기 → 사실 확인 → 저작권 확인 → 게시 순서로
            전이돼요. (신호등 라벨: {SAFETY_OPTIONS.map((s) => `${SAFETY_LEVELS[s].icon} ${SAFETY_LEVELS[s].admin}`).join(" / ")})
          </p>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "생성 중…" : "밈 생성 및 게시"}
          </button>
        </form>
      )}

      {mode === "reject" && (
        <form onSubmit={reject} className="space-y-4 border-t border-border pt-4">
          <fieldset>
            <legend className="mb-2 text-base font-medium">반려 사유 카테고리 (필수)</legend>
            <div className="flex flex-wrap gap-2">
              {REJECT_OPTIONS.map((c) => (
                <label
                  key={c}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-base ${
                    rejectCategory === c
                      ? "border-safety-red bg-safety-red-bg font-semibold text-safety-red"
                      : "border-border bg-surface-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="reject-category"
                    value={c}
                    checked={rejectCategory === c}
                    onChange={() => setRejectCategory(c)}
                    className="sr-only"
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1 block text-base font-medium">상세 사유 (필수)</span>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              className={inputCls}
              placeholder="제보자에게 전달할 사유를 적어 주세요."
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-lg bg-safety-red px-5 text-base font-semibold text-background disabled:opacity-50"
          >
            {pending ? "처리 중…" : "반려하기"}
          </button>
        </form>
      )}
    </section>
  );
}
