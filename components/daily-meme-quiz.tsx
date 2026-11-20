"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/db/client";
import { memePathFrom } from "@/lib/labels";
import type { QuizQuestion } from "@/lib/quiz";
import {
  LOCAL_STREAK_KEY,
  kstDayKey,
  parseLocalRecord,
  recordLocalAnswer,
  statusFromLocal,
  statusFromRpcRow,
  type DailyQuizStatus,
  type LocalDailyQuizRecord,
} from "@/lib/daily-quiz";

/**
 * 오늘의 밈 퀴즈 — 하루 1문제, 무료. 답하면 연속 출석(streak)이 쌓인다.
 * - 문제: /api/daily-quiz (KST 날짜 고정)
 * - 연속 출석: 로그인 → DB RPC가 정본, 비로그인 → 이 기기 localStorage
 * 홈 문서는 ISR이라 사용자 상태는 전부 마운트 후 클라이언트에서 읽는다.
 */

type RpcRow = Parameters<typeof statusFromRpcRow>[0];

function readLocal(): LocalDailyQuizRecord | null {
  try {
    return parseLocalRecord(window.localStorage.getItem(LOCAL_STREAK_KEY));
  } catch {
    return null;
  }
}

function writeLocal(record: LocalDailyQuizRecord) {
  try {
    window.localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify(record));
  } catch {
    /* 저장 불가(사파리 프라이빗 등) — 이번 화면에서만 반영 */
  }
}

async function loadServerStatus(): Promise<DailyQuizStatus | null> {
  const db = createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user || auth.user.is_anonymous) return null;
  const { data, error } = await db.rpc("get_daily_meme_quiz_status").single();
  if (error || !data) return null;
  return statusFromRpcRow(data as RpcRow);
}

/** null on failure: the local record stays and the next visit sends it again. */
async function completeOnServer(memeShortId: string, correct: boolean): Promise<DailyQuizStatus | null> {
  const { data, error } = await createClient()
    .rpc("complete_daily_meme_quiz", { p_meme_short_id: memeShortId, p_correct: correct })
    .single();
  return !error && data ? statusFromRpcRow(data as RpcRow) : null;
}

export function DailyMemeQuiz({ variant = "home" }: { variant?: "home" | "compact" }) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<DailyQuizStatus | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [unsyncedSelection, setUnsyncedSelection] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // The KST day is part of the URL, so a CDN copy of yesterday's question
        // cannot be served under today's key after midnight.
        const res = await fetch(`/api/daily-quiz?d=${kstDayKey()}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { date: string; question: QuizQuestion };
        if (!active) return;
        setQuestion(body.question);
        setDay(body.date);
      } catch {
        if (active) setFailed(true);
      }
    })();
    (async () => {
      const today = kstDayKey();
      const local = readLocal();
      const server = await loadServerStatus().catch(() => null);
      if (!active) return;
      setSignedIn(server !== null);
      setStatus(server ?? statusFromLocal(local, today));
      if (local?.lastDate === today) {
        setSelected(local.lastSelected);
        // Answered on this device (as a guest, or the save failed) but the
        // account's streak has not counted today yet.
        if (server && !server.answeredToday) setUnsyncedSelection(local.lastSelected);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (unsyncedSelection === null || !question) return;
    let active = true;
    (async () => {
      const saved = await completeOnServer(question.meme.shortId, unsyncedSelection === question.answerIndex);
      if (!active) return;
      if (saved) setStatus(saved);
      setUnsyncedSelection(null);
    })();
    return () => {
      active = false;
    };
  }, [question, unsyncedSelection]);

  const answered = selected !== null || status?.answeredToday === true;

  const onSelect = useCallback(
    async (index: number) => {
      if (!question || answered) return;
      const today = day ?? kstDayKey();
      const correct = index === question.answerIndex;
      setSelected(index);
      track("quiz_complete", { mode: "daily", score: correct ? 1 : 0 });

      const nextLocal = recordLocalAnswer(readLocal(), today, index, correct);
      writeLocal(nextLocal);
      const localStatus = statusFromLocal(nextLocal, today);
      setStatus(localStatus);

      if (!signedIn) return;
      const saved = await completeOnServer(question.meme.shortId, correct);
      if (saved) setStatus(saved);
    },
    [answered, day, question, signedIn],
  );

  if (failed) return null;

  const compact = variant === "compact";
  const streak = status?.currentStreak ?? 0;

  return (
    <section
      aria-labelledby="daily-meme-quiz-title"
      data-home-section="daily-quiz"
      /* The page that places the card owns its width and spacing. */
    >
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="daily-meme-quiz-title" className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <span aria-hidden className="inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-extrabold text-flame-800">
              오늘
            </span>
            오늘의 밈 퀴즈
            {day && (
              <span aria-hidden className="stat-mono text-xs font-normal text-muted">
                {day.slice(5).replace("-", ".")}
              </span>
            )}
          </h2>
          <StreakBadge status={status} />
        </div>

        {!question ? (
          <p role="status" className="mt-4 text-sm text-muted">
            오늘의 문제를 가져오고 있어요…
          </p>
        ) : (
          <QuestionBody
            question={question}
            selected={selected}
            answered={answered}
            onSelect={onSelect}
          />
        )}

        {answered && question && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p role="status" className="text-sm font-semibold">
              {streak > 1
                ? `${streak}일 연속 출석! 내일도 이어가요.`
                : "출석 완료! 내일 새 문제가 열려요."}
              {!signedIn && (
                <span className="mt-1 block text-xs font-normal text-muted">
                  지금은 이 기기에만 기록돼요.{" "}
                  <Link href="/login?next=/my" className="font-semibold text-accent-text underline-offset-4 hover:underline">
                    로그인
                  </Link>
                  하면 MY에서 연속 출석을 이어갈 수 있어요.
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={memePathFrom(question.meme.shortId, question.meme.slug)}
                prefetch={false}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
              >
                이 밈 보러가기
              </Link>
              {!compact && (
                <Link
                  href="/quiz"
                  className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.97]"
                >
                  10문제 더 풀기
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StreakBadge({ status }: { status: DailyQuizStatus | null }) {
  if (!status) return null;
  const streak = status.currentStreak;
  return (
    <p
      className="stat-mono inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-bold"
      aria-label={`연속 출석 ${streak}일, 최고 ${status.bestStreak}일`}
    >
      <span aria-hidden>🔥</span>
      {streak}일 연속
      {status.bestStreak > streak && (
        <span className="font-normal text-muted">· 최고 {status.bestStreak}일</span>
      )}
    </p>
  );
}

function QuestionBody({
  question,
  selected,
  answered,
  onSelect,
}: {
  question: QuizQuestion;
  selected: number | null;
  answered: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <>
      <p className="mt-3 font-semibold leading-snug sm:text-lg">{question.question}</p>
      <ol className="mt-3 space-y-2">
        {question.options.map((option, i) => {
          const isAnswer = i === question.answerIndex;
          const isPicked = i === selected;
          let stateClass = "border-border bg-surface hover:border-accent";
          if (answered) {
            if (isAnswer) stateClass = "border-safety-green bg-safety-green-bg text-safety-green";
            else if (isPicked) stateClass = "border-safety-red bg-safety-red-bg text-safety-red";
            else stateClass = "border-border bg-surface text-muted opacity-70";
          }
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={answered}
                aria-pressed={isPicked}
                className={`flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${stateClass}`}
              >
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {answered && selected !== null && (
        <p className="mt-3 text-sm font-semibold">
          {selected === question.answerIndex ? (
            <span className="text-safety-green">정답! 밈력이 느껴져요.</span>
          ) : (
            <span className="text-safety-red">아쉬워요, 정답은 {question.answerIndex + 1}번이에요.</span>
          )}
        </p>
      )}
    </>
  );
}
