"use client";

import { motion, useReducedMotion } from "motion/react";
import { LifeGauge } from "@/components/life-gauge";
import { SafetyBadge } from "@/components/safety-badge";
import type { SafetyLevel } from "@/lib/labels";
import type { MemeRow } from "@/lib/queries";

/** 신호등 글로우 색 — labels/globals의 안전 토큰 기준(색약 대응은 배지 아이콘·텍스트가 담당) */
const SAFETY_GLOW: Record<SafetyLevel, string> = {
  green: "var(--safety-green)",
  yellow: "var(--safety-yellow)",
  gray: "var(--safety-gray)",
  red: "var(--safety-red)",
};

/**
 * 정답 카드 — 상세 최상단. 밈명 + 한 줄 뜻 + 생애주기 배지 + 대형 안전 신호등.
 * 375px 첫 뷰포트에 스크롤 없이 들어가도록 컴팩트하게 유지한다.
 * 마운트 시: 카드 진입(opacity/y) + 대형 신호등 색 글로우 펄스 1회로 시선 유도.
 */
export function AnswerCard({
  meme,
}: {
  meme: Pick<
    MemeRow,
    "title" | "summary" | "lifecycle_status" | "safety_level"
  >;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      aria-label="정답 카드"
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <LifeGauge status={meme.lifecycle_status} />
      <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl">
        {meme.title}
      </h1>
      <p
        id="meme-summary"
        className="mt-1.5 text-lg leading-relaxed text-foreground"
      >
        {meme.summary}
      </p>
      <div className="relative mt-4">
        {!reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ boxShadow: `0 0 24px 4px ${SAFETY_GLOW[meme.safety_level]}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.4, ease: "easeOut", times: [0, 0.3, 1] }}
          />
        )}
        <SafetyBadge level={meme.safety_level} size="lg" />
      </div>
    </motion.section>
  );
}
