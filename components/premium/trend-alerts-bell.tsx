"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePremium } from "@/lib/hooks/use-premium";
import { memePathFrom } from "@/lib/labels";

/**
 * A1 — Plus 트렌드 알림 벨.
 * 관심 카테고리에서 라이징한 밈을 cron(fan_out_trend_alerts)이 trend_alerts에 적재하고,
 * 이 벨이 /api/trend-alerts로 읽어 안 읽은 개수 배지 + 드롭다운으로 보여준다.
 * Plus 사용자에게만 렌더되며, 비구독자에겐 아예 나타나지 않는다(전역 SSR 영향 없음).
 */

type AlertMeme = {
  id: string;
  title: string;
  slug: string;
  short_id: string;
  category: string;
  trend_score: number;
};

type Alert = {
  id: number;
  kind: string;
  trend_score: number;
  read_at: string | null;
  created_at: string;
  memes: AlertMeme | null;
};

type Payload = {
  locked: boolean;
  alerts: Alert[];
  unread: number;
};

export function TrendAlertsBell() {
  const isPremium = usePremium();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // setState는 .then 콜백(비동기) 안에서만 일어난다 — 이펙트 본문의 동기 setState를 피한다.
  const load = useCallback(() => {
    return fetch("/api/trend-alerts", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Payload>) : Promise.reject(new Error("bad status"))))
      .then((data) => setPayload(data))
      .catch(() => {
        // 알림은 부가 기능 — 실패해도 조용히 무시한다.
      });
  }, []);

  // 마운트 시 안 읽은 개수만 먼저 확보(배지 표시용).
  useEffect(() => {
    if (isPremium) void load();
  }, [isPremium, load]);

  // 외부 클릭 / ESC로 닫기.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    // 열 때 최신 목록을 다시 받고, 안 읽은 게 있으면 읽음 처리한다.
    setOpen(true);
    setLoading(true);
    void load().finally(() => setLoading(false));
    if (payload && payload.unread > 0) {
      void fetch("/api/trend-alerts", { method: "POST" }).then(() => {
        setPayload((cur) => (cur ? { ...cur, unread: 0 } : cur));
      });
    }
  }, [open, load, payload]);

  if (!isPremium) return null;

  const unread = payload?.unread ?? 0;
  const alerts = (payload?.alerts ?? []).filter((a) => a.memes !== null);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="트렌드 알림"
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:scale-[0.95]"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground">
            {/* 실시간 신호 점 — 숫자 자체는 점멸시키지 않고(가독성) 곁에 살아있음만 표시 */}
            <span aria-hidden className="signal-live absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-(--signal-cyan)" />
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-bold">트렌드 알림</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
              PLUS
            </span>
          </div>

          {loading && alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">불러오는 중…</p>
          ) : alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              아직 라이징 알림이 없어요.
              <br />
              관심 카테고리를 저장하면 급상승 밈을 알려드려요.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {alerts.map((alert) => {
                const meme = alert.memes!;
                return (
                  <li key={alert.id}>
                    <Link
                      href={memePathFrom(meme.short_id, meme.slug)}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <span
                        className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                        aria-hidden
                      >
                        <RisingIcon className="h-4 w-4" />
                        <span className="signal-live absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-(--signal-cyan)" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {meme.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          급상승 · 트렌드 {Math.round(alert.trend_score)}
                        </span>
                      </span>
                      {/* generic span의 aria-label은 명세상 미지원 — 자식 텍스트가
                          0이라 무시하는 스크린리더에서는 읽음/안 읽음 구분이 통째로
                          사라진다(루프 016과 같은 유형). 점은 장식으로 두고 의미는
                          sr-only 텍스트가 전한다. */}
                      {alert.read_at === null && (
                        <>
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                          />
                          <span className="sr-only">안 읽음</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/my/interests"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-3 text-center text-xs font-semibold text-accent transition-colors hover:bg-surface-2"
          >
            관심 카테고리 설정
          </Link>
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function RisingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  );
}
