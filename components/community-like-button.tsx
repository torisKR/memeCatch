"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginGate } from "@/components/login-gate";

const GATE_MESSAGE = "로그인하면 좋아요를 남길 수 있어요.";

/**
 * 레인 3 — 커뮤니티 글 좋아요 토글 (낙관적, save-button 패턴).
 * toggle_post_like RPC(security definer) 경유. 비로그인 탭 → LoginGate.
 * community 테이블/RPC는 database.types.ts에 아직 없어 로컬 캐스팅.
 * // TODO: types regen 후 정리
 */
export function CommunityLikeButton({
  postId,
  initialCount,
}: {
  postId: string;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  // null = 아직 모름(마운트 인증 확인 전)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const pathname = usePathname();

  // 초기 좋아요 상태 + 로그인 여부
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setLoggedIn(!!user);
      if (!user) return;
      const { data } = await createClient()
        .from("community_post_likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) setLiked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function toggle() {
    if (busy) return;
    if (loggedIn === false) {
      setGateOpen(true);
      return;
    }
    setBusy(true);
    const wasLiked = liked;
    // 낙관적 반영
    setLiked(!wasLiked);
    setCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    const { data, error } = await createClient().rpc("toggle_post_like", {
      p_post_id: postId,
    });
    setBusy(false);
    if (error) {
      // 롤백
      setLiked(wasLiked);
      setCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      if (error.message.includes("login_required")) {
        setLoggedIn(false);
        setGateOpen(true);
      }
      return;
    }
    setLoggedIn(true);
    setLiked(data === true);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={liked}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-base font-semibold transition-colors active:scale-[0.97] ${
          liked
            ? "border-(--flame-500) bg-accent-soft text-accent shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_24px_-8px_color-mix(in_srgb,var(--flame-500)_45%,transparent)]"
            : "border-border bg-surface text-foreground"
        }`}
      >
        <HeartIcon className="h-5 w-5" filled={liked} />
        좋아요 <span className="stat-mono text-signal-cyan">{count.toLocaleString("ko-KR")}</span>
      </button>
      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        message={GATE_MESSAGE}
        next={pathname}
      />
    </>
  );
}

function HeartIcon({
  className,
  filled,
}: {
  className?: string;
  filled: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20.5S4 15.5 4 9.8A4.3 4.3 0 0 1 8.3 5.5c1.6 0 3 .9 3.7 2.1a4.3 4.3 0 0 1 3.7-2.1A4.3 4.3 0 0 1 20 9.8c0 5.7-8 10.7-8 10.7Z" />
    </svg>
  );
}
