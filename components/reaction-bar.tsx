"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { REACTIONS, type ReactionType } from "@/lib/labels";
import { flags } from "@/lib/flags";
import { createClient } from "@/lib/supabase/client";
import { LoginGate } from "@/components/login-gate";

const REACTION_KEYS = Object.keys(REACTIONS) as ReactionType[];
const POP_SPRING = { type: "spring", stiffness: 400, damping: 25 } as const;
const REACTION_GATE_MESSAGE = "로그인하면 반응을 남길 수 있어요.";

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
  // 카운트 "증가" 시에만 cyan 언더라인 펄스를 트리거(키별) — 실시간 반영 신호
  const [pulseTicks, setPulseTicks] = useState<Partial<Record<ReactionType, number>>>(
    {}
  );
  // null = 아직 모름(마운트 인증 확인 전)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const reduce = useReducedMotion();
  const pathname = usePathname();

  // 로그인 여부 (커뮤니티 활성 시에만 필요 — 비활성이면 조회 생략)
  useEffect(() => {
    if (!flags.communityEnabled) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!cancelled) setLoggedIn(!!user);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function toggle(reaction: ReactionType) {
    if (!flags.communityEnabled) {
      showNotice("반응 기능은 준비 중이에요.");
      return;
    }
    // 비로그인 → 낙관적 토글 대신 로그인 유도 시트
    if (loggedIn === false) {
      setGateOpen(true);
      return;
    }
    const wasMine = mine.has(reaction);
    // 이모지 pop 트리거(리마운트)
    setPopTicks((prev) => ({ ...prev, [reaction]: (prev[reaction] ?? 0) + 1 }));
    // 카운트가 실제로 증가하는 경우에만 cyan 펄스 트리거(제거 시엔 미발동)
    if (!wasMine) {
      setPulseTicks((prev) => ({ ...prev, [reaction]: (prev[reaction] ?? 0) + 1 }));
    }
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
      // 마운트 확인 전 탭 등으로 세션이 없던 경우도 게이트로 유도
      if (error.message.includes("login_required")) {
        setLoggedIn(false);
        setGateOpen(true);
        return;
      }
      showNotice("잠시 후 다시 시도해 주세요.");
      return;
    }
    setLoggedIn(true);
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
              className={`hover-glow-flame inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-base font-medium transition-colors ${
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
                  className={`stat-mono relative inline-flex ${
                    active ? "font-bold" : "text-muted"
                  }`}
                >
                  <span className="inline-flex overflow-hidden">
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
                  {/* 카운트 증가 시 1회성 cyan 언더라인 펄스 — "지금 반영됨" 신호(opacity만) */}
                  {!reduce && (
                    <motion.span
                      key={pulseTicks[key] ?? 0}
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-(--signal-cyan)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  )}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {notice}
      </p>
      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        message={REACTION_GATE_MESSAGE}
        next={pathname}
      />
    </section>
  );
}
