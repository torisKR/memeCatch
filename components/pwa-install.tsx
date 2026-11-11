"use client";

/**
 * PWA 설치 유도 배너 (레인 E)
 *
 * 노출 조건(전부 만족해야 함):
 * - 방문 2회 이상. 첫 페이지 뷰에서는 보이지 않는다.
 * - 이미 설치(standalone)돼 있지 않음
 * - 한 번이라도 닫은 적 없음 (닫기는 영구)
 * - Android/데스크톱: beforeinstallprompt 캡처됨 / iOS Safari: 수동 안내
 *
 * 사용: app/_root/root-document.tsx의 <body> 안에 <PwaInstall /> 한 줄 추가.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

const KEY_VISITS = "mc:visits";
const KEY_DISMISSED_AT = "mc:install-dismissed-at";
const KEY_INSTALLED = "mc:installed";
const SESSION_COUNTED = "mc:visit-counted";

/** Second visit onward, and never again after the visitor closes it. */
export function installOfferAllowed(state: {
  visits: number;
  dismissed: boolean;
  installed: boolean;
  standalone: boolean;
}): boolean {
  if (state.standalone || state.installed || state.dismissed) return false;
  return state.visits >= 2;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readCount(key: string): number {
  try {
    return Number.parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari 전용 속성
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs;
}

function dismissedForever(): boolean {
  try {
    return Boolean(localStorage.getItem(KEY_DISMISSED_AT));
  } catch {
    return false;
  }
}

export function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const iosSheetTitleId = useId();
  const iosSheetRef = useRef<HTMLDivElement>(null);
  const iosSheetReturnFocusRef = useRef<HTMLElement | null>(null);

  // 방문 카운트 (세션당 1회). 안내 배너는 2회째부터.
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SESSION_COUNTED)) {
        sessionStorage.setItem(SESSION_COUNTED, "1");
        localStorage.setItem(KEY_VISITS, String(readCount(KEY_VISITS) + 1));
      }
    } catch {
      // 프라이빗 모드 등 스토리지 불가 시 조용히 통과
    }

  }, []);

  const eligible = useCallback((): boolean => {
    let installed = false;
    try {
      installed = localStorage.getItem(KEY_INSTALLED) === "1";
    } catch {
      return false;
    }
    return installOfferAllowed({
      visits: readCount(KEY_VISITS),
      dismissed: dismissedForever(),
      installed,
      standalone: isStandalone(),
    });
  }, []);

  // beforeinstallprompt 캡처 (Android/데스크톱 Chrome 계열)
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (!eligible()) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      try {
        localStorage.setItem(KEY_INSTALLED, "1");
      } catch {
        // noop
      }
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [eligible]);

  // iOS Safari — beforeinstallprompt가 없으므로 수동 안내
  // (동기 setState 경고 회피를 위해 매크로태스크로 지연)
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (isIos() && eligible()) {
        setIos(true);
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [eligible]);

  // iOS 바텀시트 포커스 트랩 — Tab 순환, Escape로 닫기, 닫힐 때 트리거로 포커스 복귀
  useEffect(() => {
    if (!showIosSheet) return;
    iosSheetReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowIosSheet(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = iosSheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && (document.activeElement === first || document.activeElement === iosSheetRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    iosSheetRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      iosSheetReturnFocusRef.current?.focus({ preventScroll: true });
      iosSheetReturnFocusRef.current = null;
    };
  }, [showIosSheet]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(KEY_DISMISSED_AT, String(Date.now()));
    } catch {
      // noop
    }
    setVisible(false);
    setShowIosSheet(false);
  }, []);

  const install = useCallback(async () => {
    if (ios) {
      setShowIosSheet(true);
      return;
    }
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        try {
          localStorage.setItem(KEY_INSTALLED, "1");
        } catch {
          // noop
        }
      }
    } catch {
      // 프롬프트 실패 시 조용히 닫기
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt, ios]);

  if (!visible) return null;

  return (
    <>
      {/* 하단 배너 — 바텀 내비 위 */}
      <div
        role="region"
        data-pwa-install-banner
        aria-label="앱 설치 안내"
        className="fixed inset-x-0 bottom-16 z-50 px-4 md:bottom-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="glass-panel hover-glow-flame mx-auto flex max-w-lg items-center gap-3 rounded-2xl p-3 shadow-lg">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
          >
            <DownloadIcon className="h-6 w-6" />
          </span>
          <p className="min-w-0 flex-1 text-base leading-snug">
            <strong className="font-semibold">밈캐치를 홈 화면에</strong>
            <br />
            <span className="text-muted">앱처럼 빠르게 열어보세요</span>
          </p>
          <button
            type="button"
            onClick={install}
            className="min-h-11 shrink-0 rounded-xl bg-accent-strong px-4 text-base font-semibold text-white"
          >
            {ios ? "방법 보기" : "설치하기"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="설치 안내 닫기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* iOS 수동 설치 바텀시트 */}
      {showIosSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={iosSheetTitleId}
          className="fixed inset-0 z-[60]"
        >
          <button
            type="button"
            aria-label="안내 닫기"
            onClick={() => setShowIosSheet(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <div
            ref={iosSheetRef}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-surface p-6 outline-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <h2 id={iosSheetTitleId} className="text-lg font-bold">홈 화면에 추가하는 방법</h2>
            <ol className="mt-4 space-y-4 text-base">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  하단의 <ShareIcon className="inline h-5 w-5 text-accent" />
                  <strong className="font-semibold">공유</strong> 버튼을 눌러요
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                  2
                </span>
                <span>
                  <strong className="font-semibold">&lsquo;홈 화면에 추가&rsquo;</strong>를
                  선택해요
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                  3
                </span>
                <span>
                  오른쪽 위 <strong className="font-semibold">&lsquo;추가&rsquo;</strong>를
                  누르면 끝나요
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-6 min-h-11 w-full rounded-xl bg-accent-strong text-base font-semibold text-white"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v12m0-12L8 7m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  );
}
