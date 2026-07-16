"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memePathFrom } from "@/lib/labels";
import type { MemeListItem } from "@/lib/queries";
import { SafetyBadge } from "@/components/safety-badge";

/**
 * "이 밈, 알아요?" — 홈 인터랙티브 위젯(밈알못 자가진단).
 * 방문자가 밈 제목을 보고 [알아요]/[처음 봐요]를 누르면 카드가 뒤집히며
 * 뜻·신호등이 공개되고, 라운드가 끝나면 아는 밈 개수와 함께 밈력고사로 연결된다.
 * 데이터는 홈이 넘긴 급상승 밈(trending)을 재사용 — 별도 네트워크 호출 없음.
 * 서버 렌더 셸(SSR)로도 첫 카드가 보이도록 상태 없이 첫 프레임을 그린다.
 */
const ROUND = 5;

export function MemeGuessGame({ memes }: { memes: MemeListItem[] }) {
  const reduce = useReducedMotion();
  // 요약이 있는 밈만, 앞에서 ROUND개 — 홈이 넘긴 순서를 그대로 신뢰(정렬은 서버 몫)
  const deck = useMemo(
    () => memes.filter((m) => m.summary && m.summary.trim().length > 0).slice(0, ROUND),
    [memes]
  );

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knew, setKnew] = useState<boolean[]>([]);

  if (deck.length < 3) return null;

  const total = deck.length;
  const done = index >= total;
  const meme = done ? null : deck[index];
  const knewCount = knew.filter(Boolean).length;

  function answer(knewIt: boolean) {
    setKnew((prev) => [...prev, knewIt]);
    setRevealed(true);
  }

  function next() {
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function restart() {
    setKnew([]);
    setRevealed(false);
    setIndex(0);
  }

  return (
    <section
      aria-labelledby="sec-guess"
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      {/* 헤더 — 브랜드 불꽃 스캐너 모티프 + 진행 표시 */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-accent-soft/70 to-transparent px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-strong text-white"
          >
            {/* 레이더/감별 스캔 아이콘 */}
            <svg
              viewBox="0 0 24 24"
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M11 11 8 8" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <h2 id="sec-guess" className="text-lg font-bold">
            이 밈, 알아요?
          </h2>
        </div>
        {/* 진행 점 — 답한 칸은 채워짐 */}
        <ol aria-hidden className="flex items-center gap-1.5">
          {deck.map((_, i) => (
            <li
              key={i}
              className={`size-2 rounded-full transition-colors ${
                i < knew.length
                  ? "bg-accent-strong"
                  : i === index
                    ? "bg-accent"
                    : "bg-border"
              }`}
            />
          ))}
        </ol>
      </div>

      <div className="p-5">
        {done ? (
          <ResultView
            total={total}
            knewCount={knewCount}
            reduce={!!reduce}
            onRestart={restart}
          />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${index}-${revealed ? "back" : "front"}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {revealed ? (
                <RevealFace
                  meme={meme!}
                  isLast={index === total - 1}
                  onNext={next}
                />
              ) : (
                <GuessFace meme={meme!} onAnswer={answer} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

/** 앞면 — 제목만 크게 보여주고 알아요/처음 봐요를 고르게 한다 */
function GuessFace({
  meme,
  onAnswer,
}: {
  meme: MemeListItem;
  onAnswer: (knewIt: boolean) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">뜻을 아는지 골라보세요</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-extrabold leading-tight md:text-3xl">
          {meme.title}
        </span>
        {meme.origin_year != null && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold tabular-nums text-muted">
            {meme.origin_year}
          </span>
        )}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className="min-h-12 rounded-xl bg-accent-strong px-4 text-base font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          알아요
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className="min-h-12 rounded-xl border border-border bg-surface px-4 text-base font-semibold text-foreground transition-colors hover:border-accent hover:text-accent active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          처음 봐요
        </button>
      </div>
    </div>
  );
}

/** 뒷면 — 뜻·신호등 공개 + 자세히 보기 + 다음 */
function RevealFace({
  meme,
  isLast,
  onNext,
}: {
  meme: MemeListItem;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <div aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-bold leading-tight">{meme.title}</p>
        <span className="shrink-0">
          <SafetyBadge level={meme.safety_level} />
        </span>
      </div>
      <p className="mt-2 text-base leading-relaxed text-foreground">
        {meme.summary}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Link
          href={memePathFrom(meme.short_id, meme.slug)}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          자세히 보기 <span aria-hidden>&nbsp;→</span>
        </Link>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-11 items-center rounded-xl bg-foreground px-5 text-sm font-bold text-surface transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isLast ? "결과 보기" : "다음 밈"} <span aria-hidden>&nbsp;→</span>
        </button>
      </div>
    </div>
  );
}

/** 결과 — 아는 밈 개수 + 밈력고사 연결 */
function ResultView({
  total,
  knewCount,
  reduce,
  onRestart,
}: {
  total: number;
  knewCount: number;
  reduce: boolean;
  onRestart: () => void;
}) {
  const pct = Math.round((knewCount / total) * 100);
  const comment =
    pct >= 80
      ? "밈 감각 상위권! 밈력고사 만점도 노려볼 만해요."
      : pct >= 40
        ? "절반은 이미 알고 있네요. 나머지도 금방이에요."
        : "지금부터 하나씩 캐치하면 딱 좋은 타이밍이에요.";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-sm font-medium text-muted">감별 결과</p>
      <p className="mt-1 text-2xl font-extrabold leading-tight">
        {total}개 중{" "}
        <span className="text-accent-text tabular-nums">{knewCount}개</span> 아는
        밈
      </p>
      <p className="mt-1.5 text-base leading-relaxed text-muted">{comment}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/quiz"
          prefetch={false}
          className="inline-flex min-h-12 items-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          밈력고사로 정식 측정 <span aria-hidden>&nbsp;→</span>
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-12 items-center rounded-xl border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          다시 하기
        </button>
      </div>
    </motion.div>
  );
}
