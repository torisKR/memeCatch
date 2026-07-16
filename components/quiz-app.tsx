"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { memePathFrom } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";
import {
  eraDecadeLabel,
  gradeForScore,
  type QuizMode,
  type QuizQuestion,
} from "@/lib/quiz";

/**
 * 밈력고사 클라이언트 플로우 — 시작(모드 선택) → 진행(10문항, 즉시 정오답
 * 피드백 + 키보드 1~4) → 결과(점수·등급·밈 감성 연대·오답 복습·공유).
 * 페이지 셸은 정적(○), 문항은 시작 시 /api/quiz에서 fetch(no-store).
 */

type Phase = "start" | "loading" | "playing" | "result" | "error";

const MODES: { key: QuizMode; label: string; desc: string }[] = [
  { key: "all", label: "전체", desc: "1990년대부터 지금까지 골고루" },
  { key: "now", label: "요즘 밈만", desc: "2020년 이후 등장한 밈" },
  { key: "retro", label: "추억 밈만", desc: "2009년 이전 그 시절 밈" },
];

export function QuizApp() {
  const [phase, setPhase] = useState<Phase>("start");
  const [mode, setMode] = useState<QuizMode>("all");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);

  const start = useCallback(async (nextMode: QuizMode) => {
    setMode(nextMode);
    setPhase("loading");
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    track("quiz_start", { mode: nextMode });
    try {
      const res = await fetch(`/api/quiz?mode=${nextMode}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { questions: QuizQuestion[] };
      if (!Array.isArray(body.questions) || body.questions.length === 0) {
        throw new Error("empty");
      }
      setQuestions(body.questions);
      setPhase("playing");
    } catch {
      setPhase("error");
    }
  }, []);

  const select = useCallback(
    (optionIndex: number) => {
      if (phase !== "playing" || selected !== null) return;
      setSelected(optionIndex);
      setAnswers((prev) => [...prev, optionIndex]);
    },
    [phase, selected]
  );

  const next = useCallback(() => {
    if (phase !== "playing" || selected === null) return;
    if (index + 1 >= questions.length) {
      const score = answers.reduce(
        (sum, picked, i) => sum + (picked === questions[i].answerIndex ? 1 : 0),
        0
      );
      track("quiz_complete", { score, mode });
      setPhase("result");
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }, [phase, selected, index, questions, answers, mode]);

  // 키보드 1~4 = 보기 선택, Enter = 다음 (진행 중에만)
  useEffect(() => {
    if (phase !== "playing") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        select(Number(event.key) - 1);
      } else if (event.key === "Enter" && selected !== null) {
        event.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, selected, select, next]);

  if (phase === "start") return <StartScreen onStart={start} />;
  if (phase === "loading") return <LoadingScreen />;
  if (phase === "error") return <ErrorScreen onRetry={() => start(mode)} />;
  if (phase === "result")
    return (
      <ResultScreen
        questions={questions}
        answers={answers}
        mode={mode}
        onRetry={() => start(mode)}
        onChangeMode={() => setPhase("start")}
      />
    );

  return (
    <QuestionScreen
      question={questions[index]}
      index={index}
      total={questions.length}
      selected={selected}
      onSelect={select}
      onNext={next}
      isLast={index + 1 >= questions.length}
    />
  );
}

/* ---------------------------------- 시작 ---------------------------------- */

function StartScreen({ onStart }: { onStart: (mode: QuizMode) => void }) {
  return (
    <section aria-label="밈력고사 시작" className="mt-6">
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-accent-strong">10문항 스피드 퀴즈</p>
        <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
          내 밈력은 몇 점?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          밈캐치 사전에 실제로 등록된 밈에서 매번 새로 출제돼요. 제목을 보고
          진짜 뜻을 골라 보세요 — 다 풀면 등급과 당신의 밈 감성 연대가 나옵니다.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onStart(m.key)}
              className="flex min-h-11 flex-col items-start gap-0.5 rounded-2xl border border-border bg-surface-2 p-4 text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
            >
              <span className="font-bold">{m.label}</span>
              <span className="text-sm text-muted">{m.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 hidden text-xs text-muted sm:block">
          키보드 1~4로도 답할 수 있어요.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- 로딩 / 오류 ------------------------------- */

function LoadingScreen() {
  return (
    <section aria-busy className="mt-6" aria-label="문제 출제 중">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <p role="status" className="font-semibold">
          사전에서 문제를 뽑고 있어요…
        </p>
        <p className="mt-1 text-sm text-muted">매번 다른 10문항이 출제됩니다.</p>
      </div>
    </section>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-6" aria-label="출제 실패">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <p role="status" className="font-semibold">
          문제를 불러오지 못했어요.
        </p>
        <p className="mt-1 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 font-bold text-white transition-transform active:scale-[0.97]"
        >
          다시 시도
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------- 진행 ---------------------------------- */

function QuestionScreen({
  question,
  index,
  total,
  selected,
  onSelect,
  onNext,
  isLast,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (i: number) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const answered = selected !== null;
  const correct = answered && selected === question.answerIndex;
  const memePath = memePathFrom(question.meme.shortId, question.meme.slug);

  return (
    <section aria-label={`문항 ${index + 1} / ${total}`} className="mt-6">
      {/* 진행 바 — flame 그라디언트 톤 */}
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-label="퀴즈 진행도"
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{
              width: `${((index + (answered ? 1 : 0)) / total) * 100}%`,
              background:
                "linear-gradient(90deg, var(--flame-400), var(--flame-600))",
            }}
          />
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {index + 1}/{total}
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold leading-snug sm:text-xl">
          {question.question}
        </h2>

        <ol className="mt-4 space-y-2.5">
          {question.options.map((option, i) => {
            const isAnswer = i === question.answerIndex;
            const isPicked = i === selected;
            let stateClass =
              "border-border bg-surface hover:border-accent focus-visible:outline-accent";
            if (answered) {
              if (isAnswer) {
                stateClass =
                  "border-safety-green bg-safety-green-bg text-safety-green";
              } else if (isPicked) {
                stateClass = "border-safety-red bg-safety-red-bg text-safety-red";
              } else {
                stateClass = "border-border bg-surface text-muted opacity-70";
              }
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  disabled={answered}
                  className={`flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base ${stateClass} ${answered ? "" : "active:scale-[0.99]"}`}
                >
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                  {answered && isAnswer && <CheckIcon />}
                  {answered && !isAnswer && isPicked && <CrossIcon />}
                </button>
              </li>
            );
          })}
        </ol>

        {/* 정오답 피드백 + 해설 링크 (선택 즉시) */}
        <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm font-semibold">
            {answered ? (
              correct ? (
                <span className="text-safety-green">정답! 밈력이 느껴져요.</span>
              ) : (
                <span className="text-safety-red">
                  아쉬워요 — 정답은 {question.answerIndex + 1}번.
                </span>
              )
            ) : (
              <span className="sr-only">보기를 선택해 주세요</span>
            )}
          </p>
          {answered && (
            <div className="flex items-center gap-2">
              <Link
                href={memePath}
                prefetch={false}
                target="_blank"
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
              >
                이 밈 보러가기 <span aria-hidden>→</span>
              </Link>
              <button
                type="button"
                onClick={onNext}
                className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {isLast ? "결과 보기" : "다음"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- 결과 ---------------------------------- */

function ResultScreen({
  questions,
  answers,
  mode,
  onRetry,
  onChangeMode,
}: {
  questions: QuizQuestion[];
  answers: number[];
  mode: QuizMode;
  onRetry: () => void;
  onChangeMode: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const total = questions.length;
  const score = answers.reduce(
    (sum, picked, i) => sum + (picked === questions[i].answerIndex ? 1 : 0),
    0
  );
  const grade = gradeForScore(score, total);
  const era = eraDecadeLabel(
    questions
      .filter((q, i) => answers[i] === q.answerIndex && q.meme.originYear !== null)
      .map((q) => q.meme.originYear as number)
  );
  const wrong = questions
    .map((q, i) => ({ q, picked: answers[i] }))
    .filter(({ q, picked }) => picked !== q.answerIndex);

  async function share() {
    const text = `나의 밈력 ${score}점 — 밈력고사에서 측정해보세요 ${SITE_URL}/quiz`;
    track("quiz_share", { score, mode });
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 공유 시트를 닫은 경우 등 — 무시 */
    }
  }

  return (
    <section aria-label="밈력고사 결과" className="mt-6">
      <div className="rounded-3xl border border-border bg-surface p-5 text-center shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-muted">나의 밈력</p>
        <p className="mt-1 text-5xl font-extrabold tabular-nums">
          {score}
          <span className="text-2xl font-bold text-muted">/{total}</span>
        </p>
        <p className="mt-3 inline-flex items-center rounded-full bg-accent-soft px-4 py-1.5 text-base font-bold text-accent-strong">
          {grade.label}
        </p>
        <p className="mt-2 text-sm text-muted sm:text-base">{grade.comment}</p>
        {era && (
          <p className="mt-1 text-sm font-semibold sm:text-base">
            당신의 밈 감성은 {era}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-strong px-5 font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ShareIcon />
            {copied ? "복사됨!" : "결과 공유"}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            다시 풀기
          </button>
          <button
            type="button"
            onClick={onChangeMode}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            모드 변경
          </button>
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="mt-5">
          <h3 className="text-lg font-bold">틀린 밈 복습하기</h3>
          <ul className="mt-3 space-y-2">
            {wrong.map(({ q }) => (
              <li key={q.meme.shortId}>
                <Link
                  href={memePathFrom(q.meme.shortId, q.meme.slug)}
                  prefetch={false}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{q.meme.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {q.options[q.answerIndex]}
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- SVG 아이콘 -------------------------------- */

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12.5 5 5L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="17" cy="6" r="2.5" />
      <circle cx="17" cy="18" r="2.5" />
      <path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6" />
    </svg>
  );
}
