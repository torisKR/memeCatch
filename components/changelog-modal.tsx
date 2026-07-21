"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CHANGELOG, LATEST_CHANGELOG_ID, type ChangelogEntry } from "@/lib/changelog";

const STORAGE_KEY = "mc:changelog:last-seen";
const SNOOZE_KEY = "mc:changelog:snooze-until";
/** 첫 페인트/LCP와 겹치지 않게 살짝 늦춰 띄운다 */
const OPEN_DELAY_MS = 800;

/** 로컬 기준 오늘 날짜(YYYY-MM-DD) — 스누즈 만료 비교용 */
function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * 배포 "새 소식" 모달 — lib/changelog.ts의 최신 항목 id와
 * localStorage에 기록된 마지막 확인 id가 다르면 1회 노출.
 * - 키 없음(첫 노출·기존 방문자 포함): 최신 1건만 노출 후 확인 시 기록.
 *   (이전의 "조용히 기록" 방식은 기능 도입 시점의 모든 기존 사용자에게
 *    첫 공지를 숨겨버리는 버그였다)
 * - /admin, /login, /auth, /onboarding 경로에서는 띄우지 않음
 * - "오늘 하루 보지 않기": 확인 기록 없이 로컬 날짜만 기록 — 당일 재노출 안 함,
 *   다음 날부터는 아직 확인 전 소식이면 다시 노출
 */
export function ChangelogModal() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!LATEST_CHANGELOG_ID) return;
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/onboarding")
    ) {
      return;
    }
    let seen: string | null = null;
    let snoozedUntil: string | null = null;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY);
      snoozedUntil = window.localStorage.getItem(SNOOZE_KEY);
    } catch {
      return; // storage 접근 불가(시크릿 등) — 노출 포기
    }
    if (seen === LATEST_CHANGELOG_ID) return;
    if (snoozedUntil === localToday()) return; // 오늘 하루 보지 않기
    if (seen === null) {
      // 키가 없으면(기능 도입 전 방문자·신규 방문자) 최신 1건만 노출한다.
      const latest = CHANGELOG.slice(0, 1);
      if (latest.length === 0) return;
      const timer = window.setTimeout(() => setEntries(latest), OPEN_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    // 마지막 확인 이후의 항목만(최대 3개) 노출. 기록된 id가 목록에서 사라졌으면 최신 3개.
    const seenIdx = CHANGELOG.findIndex((e) => e.id === seen);
    const unseen = seenIdx === -1 ? CHANGELOG.slice(0, 3) : CHANGELOG.slice(0, Math.min(seenIdx, 3));
    if (unseen.length === 0) return;
    const t = window.setTimeout(() => setEntries(unseen), OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const dismiss = useCallback(() => {
    if (LATEST_CHANGELOG_ID) {
      try {
        window.localStorage.setItem(STORAGE_KEY, LATEST_CHANGELOG_ID);
      } catch {
        /* noop */
      }
    }
    setEntries(null);
  }, []);

  // 오늘 하루 보지 않기 — 확인 기록 없이 당일만 숨긴다
  const snoozeToday = useCallback(() => {
    try {
      window.localStorage.setItem(SNOOZE_KEY, localToday());
    } catch {
      /* noop */
    }
    setEntries(null);
  }, []);

  // 열림 상태 — 포커스 이동, ESC 닫기, 배경 스크롤 잠금
  useEffect(() => {
    if (!entries) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [entries, dismiss]);

  if (!entries) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
    >
      {/* 배경 클릭으로도 닫기 */}
      <button
        type="button"
        aria-label="새 소식 닫기"
        onClick={dismiss}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">새 소식</p>
        <h2 id="changelog-title" className="mt-1 text-lg font-bold text-foreground">
          밈캐치가 업데이트됐어요
        </h2>
        <div className="mt-3 max-h-[50dvh] space-y-4 overflow-y-auto">
          {entries.map((entry) => (
            <section key={entry.id}>
              <h3 className="text-sm font-semibold text-foreground">
                {entry.title}
                <span className="ml-1.5 font-normal text-muted">{entry.date}</span>
              </h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
                {entry.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button
          ref={confirmRef}
          type="button"
          onClick={dismiss}
          className="no-press mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
        >
          확인했어요
        </button>
        <button
          type="button"
          onClick={snoozeToday}
          className="no-press mt-2 inline-flex h-10 w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-muted transition-colors hover:text-foreground"
        >
          오늘 하루 보지 않기
        </button>
      </div>
    </div>
  );
}
