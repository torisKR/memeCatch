"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginGate } from "@/components/login-gate";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { localizedStaticPath } from "@/lib/i18n-routing";
import { track } from "@/lib/analytics";

const SAVE_INTENT_KEY = "memecatch:save-intents:v1";
const SAVE_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_INTENT_LIMIT = 10;
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

export function getSaveFailure(message: string): "login" | "premium-limit" | "retry" {
  if (message.includes("login_required")) return "login";
  if (message.includes("premium_save_limit")) return "premium-limit";
  return "retry";
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
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);
  const pathname = usePathname();
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale].save;

  function rememberGuestSave() {
    const intents = readSaveIntents();
    if (!intents.some((intent) => intent.memeId === memeId) && intents.length >= SAVE_INTENT_LIMIT) {
      setNotice(copy.limitReached);
      setUpgradeRequired(true);
      setGateOpen(false);
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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setLoggedIn(!!user);
      if (!user) return;

      const queued = readSaveIntents();
      const remaining: SaveIntent[] = [];
      for (const intent of queued) {
        const { error } = await supabase.rpc("save_meme", { p_meme_id: intent.memeId });
        if (error && !isTerminalSaveError(error)) remaining.push(intent);
        if (!error && intent.memeId === memeId) setSaved(true);
      }
      writeSaveIntents(remaining);

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
    setUpgradeRequired(false);
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
      if (failure === "premium-limit") {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
        setNotice(copy.limitReached);
        setUpgradeRequired(true);
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
      {upgradeRequired && (
        <Link
          href={localizedStaticPath("/pricing?source=save_limit_11", locale)}
          className="mt-1 flex min-h-11 items-center justify-center rounded-xl text-sm font-bold text-accent-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.upgrade}
        </Link>
      )}
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
