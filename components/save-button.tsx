"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginGate } from "@/components/login-gate";

const SAVE_GATE_MESSAGE = "로그인하면 밈을 저장할 수 있어요.";

/**
 * 밈 저장 토글 — toggle_save RPC(security definer) 경유.
 * 저장한 밈은 MY 페이지(/my)의 '저장한 밈'에 나타난다.
 * 사용자별 초기 저장 상태는 공개 문서 SSR과 분리해 클라이언트에서 조회.
 * 비로그인 상태에서 탭하면 로그인 유도 시트(LoginGate)를 연다.
 */
export function SaveButton({ memeId }: { memeId: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // null = 아직 모름(마운트 인증 확인 전)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const pathname = usePathname();

  // 초기 저장 상태 + 로그인 여부 (비로그인이면 RLS로 0행 → false 유지)
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
      const { data } = await supabase
        .from("saved_memes")
        .select("meme_id")
        .eq("meme_id", memeId)
        .maybeSingle();
      if (!cancelled && data) setSaved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [memeId]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function toggle() {
    if (busy) return;
    // 비로그인 → 낙관적 토글 대신 로그인 유도 시트
    if (loggedIn === false) {
      setGateOpen(true);
      return;
    }
    setBusy(true);
    const wasSaved = saved;
    setSaved(!wasSaved); // 낙관적 반영
    const { data, error } = await createClient().rpc("toggle_save", {
      p_meme_id: memeId,
    });
    setBusy(false);
    if (error) {
      setSaved(wasSaved); // 롤백
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
    const nowSaved = data === true;
    setSaved(nowSaved);
    if (nowSaved) {
      // PWA 설치 배너의 저장 행동 카운트 (components/pwa-install.tsx)
      window.dispatchEvent(new Event("memecatch:save"));
      showNotice("MY에 저장했어요.");
    } else {
      showNotice("저장을 해제했어요.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-base font-semibold transition-colors ${
          saved
            ? "border-accent bg-accent-soft text-accent"
            : "border-border bg-surface text-foreground"
        }`}
      >
        <BookmarkIcon className="h-5 w-5" filled={saved} />
        {saved ? "저장한 밈" : "이 밈 저장하기"}
      </button>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-center text-sm text-muted">
        {notice}
      </p>
      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        message={SAVE_GATE_MESSAGE}
        next={pathname}
      />
    </div>
  );
}

function BookmarkIcon({
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
      aria-hidden
    >
      <path
        d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
