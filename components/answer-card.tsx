"use client";

import { motion, useReducedMotion } from "motion/react";
import { DocClassNote } from "@/components/doc-class-note";
import { ARTICLE_BODY, MemeArticleArt, MemeByline } from "@/components/meme-article-meta";
import { SaveButton } from "@/components/save-button";
import { SafetyBadge } from "@/components/safety-badge";
import { SignalTrace } from "@/components/signal-trace";
import { CopyTextButton } from "@/components/copy-text-button";
import { LIFECYCLE_STATUS, type SafetyLevel } from "@/lib/labels";
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
  saveMemeId,
  reviewedAt,
}: {
  meme: Pick<
    MemeRow,
    "title" | "summary" | "lifecycle_status" | "safety_level"
  > & {
    updated_at?: MemeRow["updated_at"] | null;
    /** 상세 조회(select("*"))에서만 실려 온다 — 목록·위젯 select에는 없어 optional. */
    doc_class?: MemeRow["doc_class"];
    usage_note?: MemeRow["usage_note"];
    art_url?: MemeRow["art_url"] | null;
    origin_year?: MemeRow["origin_year"] | null;
  };
  saveMemeId?: string;
  /** Present only when this article is indexable. */
  reviewedAt?: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      aria-label="정답 카드"
      className="hover-glow-flame rounded-2xl border border-border bg-surface p-5 shadow-sm"
      initial={reduce ? false : { y: 12 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* 판독 헤더 — 계측 화면의 채널 라벨. 지금 이 밈이 어느 단계인지 먼저 말한다. */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-(--signal-cyan)" />
          생애 신호
        </span>
        <span className="stat-mono text-[11px] font-bold text-muted">
          {LIFECYCLE_STATUS[meme.lifecycle_status].user}
        </span>
      </div>

      {/* 이 밈 자신의 파형 — 홈 범례에서 배운 언어를 상세에서 크게 읽는다. */}
      <div className="instrument-grid mt-2 rounded-xl border border-border/70 px-3 py-2">
        <SignalTrace status={meme.lifecycle_status} size="lg" />
      </div>

      <div className="mt-4 flex items-start justify-end">
        <CopyTextButton
          text={`${meme.title}: ${meme.summary}`}
          label="복사"
          copiedLabel="복사됨"
          ariaLabel="밈 명칭 및 요약 복사"
          variant="pill"
          className="shrink-0"
        />
      </div>
      <div className="mt-3">
        <MemeArticleArt title={meme.title} artUrl={meme.art_url} />
        <h1 className="text-[1.75rem] font-black leading-tight tracking-tight">{meme.title}</h1>
        <MemeByline updatedAt={meme.updated_at} reviewedAt={reviewedAt} />
        {meme.summary.trim() ? (
          <p id="meme-summary" className={`mt-3 ${ARTICLE_BODY}`}>
            {meme.summary}
          </p>
        ) : null}
      </div>
      <DocClassNote docClass={meme.doc_class} />
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
      {meme.usage_note && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
          <strong className="text-foreground">사용 예</strong> · {meme.usage_note}
        </p>
      )}
      {saveMemeId && (
        <div className="mt-4">
          <SaveButton memeId={saveMemeId} />
        </div>
      )}
    </motion.section>
  );
}
