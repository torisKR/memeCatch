"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { REACTIONS, type ReactionType } from "@/lib/labels";
import { flags } from "@/lib/flags";
import { createClient } from "@/lib/supabase/client";

const REACTION_KEYS = Object.keys(REACTIONS) as ReactionType[];
const POP_SPRING = { type: "spring", stiffness: 400, damping: 25 } as const;

/**
 * 반응 바 — labels.REACTIONS 6종.
 * communityEnabled=false: 카운트 읽기전용 + "준비 중" 툴팁.
 * true: toggle_reaction RPC 낙관적 토글(실패 시 롤백).
 */
export function ReactionBar({
  memeId,
  initialCounts,
}: {
  memeId: string;
  initialCounts: Partial<Record<ReactionType, number>>;
}) {
  const [counts, setCounts] =
    useState<Partial<Record<ReactionType, number>>>(initialCounts);
  const [mine, setMine] = useState<Set<ReactionType>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  // 탭 시 이모지 pop을 트리거하는 리마운트 카운터(키별)
  const [popTicks, setPopTicks] = useState<Partial<Record<ReactionType, number>>>(
    {}
  );
  const reduce = useReducedMotion();

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function toggle(reaction: ReactionType) {
    if (!flags.communityEnabled) {
      showNotice("반응 기능은 준비 중이에요.");
      return;
    }
    const wasMine = mine.has(reaction);
    // 이모지 pop 트리거(리마운트)
    setPopTicks((prev) => ({ ...prev, [reaction]: (prev[reaction] ?? 0) + 1 }));
    // 낙관적 반영
    setMine((prev) => {
      const next = new Set(prev);
      if (wasMine) next.delete(reaction);
      else next.add(reaction);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [reaction]: Math.max(0, (prev[reaction] ?? 0) + (wasMine ? -1 : 1)),
    }));

    const { error } = await createClient().rpc("toggle_reaction", {
      p_meme_id: memeId,
      p_reaction: reaction,
    });
    if (error) {
      // 롤백
      setMine((prev) => {
        const next = new Set(prev);
        if (wasMine) next.add(reaction);
        else next.delete(reaction);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [reaction]: Math.max(0, (prev[reaction] ?? 0) + (wasMine ? 1 : -1)),
      }));
      showNotice(
        error.message.includes("login_required")
          ? "로그인하면 반응을 남길 수 있어요."
          : "잠시 후 다시 시도해 주세요."
      );
    }
  }

  const readOnly = !flags.communityEnabled;

  return (
    <section
      aria-labelledby="reaction-bar-title"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="reaction-bar-title" className="text-lg font-bold">
        이 밈, 어땠어요?
      </h2>
      {readOnly && (
        <p className="mt-1 text-sm text-muted">반응 남기기는 준비 중이에요.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {REACTION_KEYS.map((key) => {
          const meta = REACTIONS[key];
          const active = mine.has(key);
          const count = counts[key] ?? 0;
          const tick = popTicks[key] ?? 0;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              title={readOnly ? "준비 중" : undefined}
              aria-disabled={readOnly}
              aria-pressed={readOnly ? undefined : active}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-base font-medium transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface-2 text-foreground"
              } ${readOnly ? "opacity-70" : ""}`}
            >
              {/* 탭 시 pop: tick 변경으로 리마운트되며 scale 1.3→1 spring */}
              <motion.span
                key={tick}
                aria-hidden
                className="inline-block"
                initial={reduce ? false : { scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={POP_SPRING}
              >
                {meta.emoji}
              </motion.span>
              {meta.user}
              {count > 0 && (
                <span
                  className={`inline-flex overflow-hidden ${
                    active ? "font-bold" : "text-muted"
                  }`}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={count}
                      initial={reduce ? false : { y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { y: 10, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {count}
                    </motion.span>
                  </AnimatePresence>
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {notice}
      </p>
    </section>
  );
}
