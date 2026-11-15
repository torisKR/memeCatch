"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { LANGUAGE_NAMES, toBcp47, type Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { localizedMemePath, localizedStaticPath } from "@/lib/i18n-routing";
import {
  GLOBAL_DAILY_COPY,
  type GlobalDailyCopy,
} from "@/lib/global-daily-challenge-copy";
import {
  isValidGlobalDailyQuestion,
  type GlobalDailyLocale,
} from "@/lib/global-daily-challenge";
import type { QuizQuestion } from "@/lib/quiz";

type ChallengeState = "signed_out" | "locked" | "unavailable" | "ready" | "completed";

type CompletionResult = {
  correct: number;
  total: number;
  currentStreak: number;
  alreadyCompleted: boolean;
};

export function GlobalDailyChallenge({
  locale,
  displayLocale,
  challengeDate,
  state,
  questions,
  currentStreak = 0,
  marketPassport,
  showReviewShelf = false,
  oneCutHandoffByMemeId,
}: {
  locale: GlobalDailyLocale;
  displayLocale?: Locale;
  challengeDate: string;
  state: ChallengeState;
  questions: readonly QuizQuestion[];
  currentStreak?: number;
  marketPassport?: React.ReactNode;
  showReviewShelf?: boolean;
  oneCutHandoffByMemeId?: Readonly<Record<string, string>>;
}) {
  const copy = GLOBAL_DAILY_COPY[locale];
  const resolvedDisplayLocale = displayLocale ?? locale;
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const reviewShelfId = useId();

  const dailyPath = localizedStaticPath("/daily", resolvedDisplayLocale);
  const dateText = new Intl.DateTimeFormat(toBcp47(resolvedDisplayLocale), {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${challengeDate}T12:00:00+09:00`));
  function start() {
    setStarted(true);
    track("global_daily_start", {
      locale,
      display_locale: resolvedDisplayLocale,
      challenge_date: challengeDate,
    });
  }

  function selectOption(optionIndex: number) {
    if (!started || selected !== null || submitting) return;
    setSelected(optionIndex);
    setError(null);
  }

  async function next() {
    if (selected === null || submitting) return;
    const question = questions[questionIndex];
    const nextCorrect = correct + (selected === question.answerIndex ? 1 : 0);
    if (questionIndex < questions.length - 1) {
      setCorrect(nextCorrect);
      setSelected(null);
      setQuestionIndex((value) => value + 1);
      return;
    }

    setCorrect(nextCorrect);
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/plus/global-daily/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json().catch(() => null)) as {
        currentStreak?: number;
        alreadyCompleted?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.currentStreak) {
        throw new Error(payload?.error || "completion_failed");
      }
      const completion = {
        correct: nextCorrect,
        total: questions.length,
        currentStreak: payload.currentStreak,
        alreadyCompleted: Boolean(payload.alreadyCompleted),
      };
      setResult(completion);
      track("global_daily_complete", {
        locale,
        display_locale: resolvedDisplayLocale,
        challenge_date: challengeDate,
        score: nextCorrect,
      });
    } catch {
      setError(copy.retry);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="global-daily-title"
      lang={toBcp47(locale)}
      data-global-daily-state={state}
      data-global-daily-content-locale={locale}
      data-global-daily-display-locale={resolvedDisplayLocale}
      className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-accent-text">{copy.eyebrow}</p>
          <h2 id="global-daily-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{copy.intro}</p>
          {resolvedDisplayLocale !== locale && (
            <p
              data-global-daily-content-language
              className="mt-2 text-xs font-semibold text-muted"
            >
              {copy.contentLanguageLabel}: {LANGUAGE_NAMES[locale]}
            </p>
          )}
        </div>
        <time
          dateTime={challengeDate}
          lang={toBcp47(resolvedDisplayLocale)}
          className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted"
        >
          {copy.dateLabel}: {dateText}
        </time>
      </div>

      {state === "signed_out" && (
        <GatePanel title={copy.signedOutTitle} body={copy.signedOutBody}>
          <Link
            href={`/login?next=${encodeURIComponent(dailyPath)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.signIn}
          </Link>
        </GatePanel>
      )}

      {state === "locked" && (
        <GatePanel title={copy.lockedTitle} body={copy.lockedBody}>
          <Link
            href={localizedStaticPath("/pricing", resolvedDisplayLocale)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.upgrade}
          </Link>
        </GatePanel>
      )}

      {state === "unavailable" && (
        <GatePanel title={copy.unavailableTitle} body={copy.unavailableBody} />
      )}

      {state === "completed" && (
        <CompletionPanel
          copy={copy}
          correct={null}
          total={questions.length}
          streak={currentStreak}
          locale={locale}
          questions={questions}
          marketPassport={marketPassport}
          reviewShelfId={reviewShelfId}
          showReviewShelf={showReviewShelf}
          oneCutHandoffByMemeId={oneCutHandoffByMemeId}
        />
      )}

      {state === "ready" && !result && !started && (
        <div className="mt-6 rounded-2xl border border-accent/25 bg-accent-soft/30 p-5">
          <div className="flex flex-wrap gap-2 text-xs font-bold text-muted">
            <span className="rounded-full bg-surface px-3 py-1.5">{copy.reviewedLabel}</span>
            <span className="rounded-full bg-surface px-3 py-1.5">{copy.currentLabel}</span>
            <span className="rounded-full bg-surface px-3 py-1.5">{copy.safetyLabel}</span>
          </div>
          <button
            type="button"
            onClick={start}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.start}
          </button>
        </div>
      )}

      {state === "ready" && started && !result && questions[questionIndex] && (
        <QuestionPanel
          copy={copy}
          question={questions[questionIndex]}
          locale={locale}
          challengeDate={challengeDate}
          questionIndex={questionIndex}
          total={questions.length}
          selected={selected}
          submitting={submitting}
          error={error}
          onSelect={selectOption}
          onNext={next}
        />
      )}

      {state === "ready" && result && (
        <CompletionPanel
          copy={copy}
          correct={result.correct}
          total={result.total}
          streak={result.currentStreak}
          locale={locale}
          questions={questions}
          marketPassport={marketPassport}
          reviewShelfId={reviewShelfId}
          showReviewShelf={showReviewShelf}
          oneCutHandoffByMemeId={oneCutHandoffByMemeId}
        />
      )}
    </section>
  );
}

function GatePanel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function QuestionPanel({
  copy,
  question,
  locale,
  challengeDate,
  questionIndex,
  total,
  selected,
  submitting,
  error,
  onSelect,
  onNext,
}: {
  copy: GlobalDailyCopy;
  question: QuizQuestion;
  locale: GlobalDailyLocale;
  challengeDate: string;
  questionIndex: number;
  total: number;
  selected: number | null;
  submitting: boolean;
  error: string | null;
  onSelect: (index: number) => void;
  onNext: () => void;
}) {
  const answered = selected !== null;
  const isCorrect = answered && selected === question.answerIndex;
  const memePath = localizedMemePath(locale, question.meme.shortId, question.meme.slug);
  const safety = copy.safety[question.meme.safetyLevel as keyof typeof copy.safety] ?? copy.safety.yellow;

  return (
    <div className="mt-6" data-question-date={challengeDate}>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={questionIndex + 1}
          aria-label={copy.questionProgress(questionIndex + 1, total)}
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-accent-strong transition-[width] motion-reduce:transition-none"
            style={{ width: `${((questionIndex + 1) / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-semibold text-muted">{copy.questionProgress(questionIndex + 1, total)}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-wrap gap-2 text-xs font-bold text-muted">
          <span className="rounded-full bg-surface-2 px-3 py-1.5">{copy.reviewedLabel}</span>
          <span className="rounded-full bg-surface-2 px-3 py-1.5">{copy.currentLabel}</span>
          <span className="rounded-full bg-surface-2 px-3 py-1.5">{copy.safetyLabel}: {safety}</span>
        </div>
        <h3 className="mt-5 text-xl font-black leading-snug">{question.question}</h3>
        <ol className="mt-5 space-y-2.5">
          {question.options.map((option, optionIndex) => {
            const optionCorrect = optionIndex === question.answerIndex;
            const optionSelected = optionIndex === selected;
            const stateClass = !answered
              ? "border-border bg-surface hover:border-accent"
              : optionCorrect
                ? "border-safety-green bg-safety-green-bg text-safety-green"
                : optionSelected
                  ? "border-safety-red bg-safety-red-bg text-safety-red"
                  : "border-border bg-surface text-muted opacity-70";
            return (
              <li key={`${question.meme.shortId}-${optionIndex}`}>
                <button
                  type="button"
                  aria-pressed={optionSelected}
                  aria-label={`${option + (optionSelected ? `, ${copy.selected}` : "")}`}
                  disabled={answered || submitting}
                  onClick={() => onSelect(optionIndex)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-base ${stateClass}`}
                >
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold">
                    {optionIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="min-h-6 text-sm font-semibold">
            {answered ? (isCorrect ? copy.correct : copy.incorrect(question.answerIndex + 1)) : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {answered && (
              <Link
                href={memePath}
                prefetch={false}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-muted hover:border-accent hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copy.openMeme}
              </Link>
            )}
            {answered && (
              <button
                type="button"
                onClick={onNext}
                disabled={submitting}
                aria-busy={submitting}
                className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                {submitting ? copy.submitting : questionIndex === total - 1 ? copy.finish : copy.next}
              </button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-safety-red-bg px-3 py-2.5 text-sm text-safety-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function CompletionPanel({
 copy,
 correct,
 total,
 streak,
  locale,
  questions,
  marketPassport,
  reviewShelfId,
  showReviewShelf,
  oneCutHandoffByMemeId,
}: {
 copy: GlobalDailyCopy;
 correct: number | null;
 total: number;
 streak: number;
  locale: GlobalDailyLocale;
  questions: readonly QuizQuestion[];
  marketPassport?: React.ReactNode;
  reviewShelfId: string;
  showReviewShelf: boolean;
  oneCutHandoffByMemeId?: Readonly<Record<string, string>>;
}) {
 const reviewShelfTitleId = `${reviewShelfId}-title`;
 const canShowReviewShelf =
   showReviewShelf && questions.length > 0 && questions.every(isValidGlobalDailyQuestion);
 const canShowNextStep = Boolean(questions[0]) && !showReviewShelf;
 return (
   <div role="status" aria-live="polite" className="mt-6 rounded-2xl border border-safety-green/40 bg-safety-green-bg p-5">
     <p className="text-xs font-black tracking-[0.16em] text-safety-green">{copy.eyebrow}</p>
     <h3 className="mt-2 text-xl font-black text-safety-green">{copy.completedTitle}</h3>
     <p className="mt-2 text-sm leading-relaxed text-safety-green">{copy.completedBody(streak)}</p>
 <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-safety-green">
       {correct === null ? <span>{copy.streak(streak)}</span> : <span>{copy.score(correct, total)}</span>}
       {correct !== null && <span>{copy.streak(streak)}</span>}
     </div>
      {marketPassport && (
        <div data-global-daily-market-passport className="mt-5 text-foreground">
          {marketPassport}
        </div>
      )}
      {canShowReviewShelf && (
        <section
          aria-labelledby={reviewShelfTitleId}
          data-global-daily-review-shelf
          data-global-daily-review-count={questions.length}
          className="mt-5 rounded-2xl border border-border bg-surface p-4 text-foreground"
        >
          <h4 id={reviewShelfTitleId} className="text-sm font-black text-accent-text">
            {copy.reviewShelfTitle}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.reviewShelfBody}</p>
          <ol className="mt-4 grid gap-3">
            {questions.map((question, index) => {
              const safety =
                copy.safety[question.meme.safetyLevel as keyof typeof copy.safety] ?? copy.safety.yellow;
              const meaning = question.options[question.answerIndex];
              const href = `${localizedMemePath(locale, question.meme.shortId, question.meme.slug)}#meme-use-kit-title`;
              const oneCutHref = oneCutHandoffByMemeId?.[question.meme.id ?? question.meme.shortId];
              return (
                <li
                  key={`${question.meme.shortId}-${index}`}
                  data-global-daily-review-item={question.meme.shortId}
                  className="rounded-xl border border-border bg-surface-2 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-black text-accent-text"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold leading-snug">{question.meme.title}</h5>
                      <dl className="mt-3 grid gap-2 text-xs leading-relaxed">
                        <div>
                          <dt className="font-semibold text-foreground">{copy.reviewShelfMeaningLabel}</dt>
                          <dd className="text-muted">{meaning}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">{copy.reviewShelfSafetyLabel}</dt>
                          <dd className="text-muted">{safety}</dd>
                        </div>
                      </dl>
                      <Link
                        href={href}
                        prefetch={false}
                        aria-label={`${copy.reviewShelfOpen}: ${question.meme.title}`}
                        className="mt-3 inline-flex min-h-11 items-center rounded-xl font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {copy.reviewShelfOpen}
                        <span aria-hidden> →</span>
                      </Link>
                      {typeof oneCutHref === "string" && oneCutHref.startsWith("/premium?") && (
                        <Link
                          href={oneCutHref}
                          prefetch={false}
                          data-global-daily-one-cut={question.meme.shortId}
                          aria-label={`${copy.reviewShelfOneCut}: ${question.meme.title}`}
                          className="mt-3 ml-2 inline-flex min-h-11 items-center rounded-xl border border-accent px-3 font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {copy.reviewShelfOneCut}
                          <span aria-hidden> →</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {canShowNextStep && (
        <div
          data-global-daily-next-step
          className="mt-5 rounded-2xl border border-accent/30 bg-surface p-4 text-foreground"
        >
          <h4 className="text-sm font-black text-accent-text">{copy.continueTitle}</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.continueBody}</p>
          <p className="mt-3 text-sm font-bold">「{questions[0].meme.title}」</p>
          <Link
            href={`${localizedMemePath(locale, questions[0].meme.shortId, questions[0].meme.slug)}#meme-use-kit-title`}
            prefetch={false}
            aria-label={`${copy.continueAction}: ${questions[0].meme.title}`}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.continueAction}
          </Link>
        </div>
      )}
   </div>
 );
}
