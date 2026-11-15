"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/db/client";
import { LoginGate } from "@/components/login-gate";
import { useLocale } from "@/lib/i18n-client";
import { withLocaleFallback } from "@/lib/i18n";
import { track } from "@/lib/analytics";

const SAVE_INTENT_KEY = "memecatch:save-intents:v1";
const SAVE_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_INTENT_LIMIT = 10;
const SAVE_COPY = withLocaleFallback({
  ko: {
    loginGate: "로그인하면 밈을 저장할 수 있어요.",
    savedButton: "저장한 밈",
    saveButton: "이 밈 저장하기",
    saved: "MY에 저장했어요.",
    removed: "저장을 해제했어요.",
    retry: "잠시 후 다시 시도해 주세요.",
  },
  en: {
    loginGate: "Log in to save memes.",
    savedButton: "Saved",
    saveButton: "Save this meme",
    saved: "Saved to MY.",
    removed: "Removed from saved memes.",
    retry: "Please try again in a moment.",
  },
  ja: {
    loginGate: "ログインするとミームを保存できます。",
    savedButton: "保存済み",
    saveButton: "このミームを保存",
    saved: "MYに保存しました。",
    removed: "保存を解除しました。",
    retry: "しばらくしてからもう一度お試しください。",
  },
  zh: {
    loginGate: "登录后即可收藏迷因。",
    savedButton: "已收藏",
    saveButton: "收藏这个迷因",
    saved: "已收藏到我的页面。",
    removed: "已取消收藏。",
    retry: "请稍后再试。",
  },
});
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SaveIntent = { memeId: string; createdAt: number };

export function parseSaveIntents(raw: string | null, now = Date.now()): SaveIntent[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const deduped = new Map<string, SaveIntent>();
    for (const item of value) {
      if (
        typeof item === "object" &&
        item !== null &&
        "memeId" in item &&
        typeof item.memeId === "string" &&
        UUID_RE.test(item.memeId) &&
        "createdAt" in item &&
        typeof item.createdAt === "number" &&
        item.createdAt <= now &&
        now - item.createdAt < SAVE_INTENT_TTL_MS
      ) {
        deduped.delete(item.memeId);
        deduped.set(item.memeId, { memeId: item.memeId, createdAt: item.createdAt });
      }
    }
    return [...deduped.values()].slice(-SAVE_INTENT_LIMIT);
  } catch {
    return [];
  }
}

export function enqueueSaveIntent(
  intents: SaveIntent[],
  memeId: string,
  now = Date.now()
): SaveIntent[] {
  if (!UUID_RE.test(memeId)) return intents;
  return [
    ...intents.filter(
      (intent) => intent.memeId !== memeId && now - intent.createdAt < SAVE_INTENT_TTL_MS
    ),
    { memeId, createdAt: now },
  ].slice(-SAVE_INTENT_LIMIT);
}

function isTerminalSaveError(error: { code?: string; message: string }) {
  return error.code === "22P02" || error.code === "23503" || error.message.includes("premium_save_limit");
}

function readSaveIntents() {
  try {
    return parseSaveIntents(window.localStorage.getItem(SAVE_INTENT_KEY));
  } catch {
    return [];
  }
}

function writeSaveIntents(intents: SaveIntent[]) {
  try {
    if (intents.length) window.localStorage.setItem(SAVE_INTENT_KEY, JSON.stringify(intents));
    else window.localStorage.removeItem(SAVE_INTENT_KEY);
  } catch {}
}

export function getSaveFailure(message: string): "login" | "retry" {
  return message.includes("login_required") ? "login" : "retry";
}

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
  const noticeTimerRef = useRef<number | null>(null);
  const pathname = usePathname();
  const { locale } = useLocale();
  const copy = SAVE_COPY[locale];

  function rememberGuestSave() {
    const intents = readSaveIntents();
    if (!intents.some((intent) => intent.memeId === memeId) && intents.length >= SAVE_INTENT_LIMIT) {
      // 대기열이 가득 차면 더 쌓지 않고 로그인부터 유도한다.
      setGateOpen(true);
      return;
    }
    writeSaveIntents(enqueueSaveIntent(intents, memeId));
    setSaved(true);
    setGateOpen(true);
  }

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  // 초기 저장 상태 + 로그인 여부 (비로그인이면 RLS로 0행 → false 유지)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (cancelled) return;
      setLoggedIn(!!user);
      if (!user) return;

      const queued = readSaveIntents();
      const remaining: SaveIntent[] = [];
      for (const intent of queued) {
        const { error } = await db.rpc("save_meme", { p_meme_id: intent.memeId });
        if (error && !isTerminalSaveError(error)) remaining.push(intent);
        if (!error && intent.memeId === memeId) setSaved(true);
      }
      writeSaveIntents(remaining);

      const { data } = await db
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
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 2500);
  }

  async function toggle() {
    if (busy) return;
    if (!saved) track("follow_click", { meme_id: memeId });
    // 비로그인 → 낙관적 토글 대신 로그인 유도 시트
    if (loggedIn === false) {
      rememberGuestSave();
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
      const failure = getSaveFailure(error.message);
      if (failure === "login") {
        setLoggedIn(false);
        rememberGuestSave();
        return;
      }
      showNotice(copy.retry);
      return;
    }
    setLoggedIn(true);
    const nowSaved = data === true;
    setSaved(nowSaved);
    if (nowSaved) {
      // PWA 설치 배너의 저장 행동 카운트 (components/pwa-install.tsx)
      window.dispatchEvent(new Event("memecatch:save"));
      showNotice(copy.saved);
    } else {
      showNotice(copy.removed);
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
            ? "border-accent bg-accent-soft text-accent shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)]"
            : "border-border bg-surface text-foreground"
        }`}
      >
        <BookmarkIcon className="h-5 w-5" filled={saved} />
        {saved ? copy.savedButton : copy.saveButton}
      </button>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-center text-sm text-muted">
        {notice}
      </p>
      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        message={copy.loginGate}
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
