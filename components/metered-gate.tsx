"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 미터링 게이트 — 하루 FREE_LIMIT개까지는 그대로 보여주고, 그 이상부터 로그인 유도.
 *
 * SEO 원칙(중요):
 * - 서버는 누구에게나 **동일한 HTML**을 보낸다. 게이트는 전적으로 클라이언트에서
 *   방문자 본인의 열람 기록(localStorage)으로만 판단하므로 클로킹이 아니다.
 * - Googlebot은 localStorage 이력이 없어 항상 무료 구간에 있다 → 색인 영향 없음.
 * - 상세 페이지의 SSG를 지키기 위해 서버에서 세션·쿠키를 읽지 않는다.
 *
 * 로그인 사용자에겐 아예 렌더하지 않는다.
 */

const FREE_LIMIT = 5;
const STORAGE_KEY = "mc_meter_v1";

type MeterState = { date: string; ids: string[] };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readMeter(): MeterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), ids: [] };
    const parsed = JSON.parse(raw) as MeterState;
    if (parsed.date !== today() || !Array.isArray(parsed.ids)) {
      return { date: today(), ids: [] };
    }
    return parsed;
  } catch {
    return { date: today(), ids: [] };
  }
}

function writeMeter(state: MeterState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 프라이빗 모드 등 저장 불가 — 게이트를 걸지 않는 쪽으로 실패한다 */
  }
}

export function MeteredGate({ memeId }: { memeId: string }) {
  const [blocked, setBlocked] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 로그인 사용자는 미터링 대상이 아니다
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (cancelled || session) return;

      const meter = readMeter();
      if (!meter.ids.includes(memeId)) {
        meter.ids = [...meter.ids, memeId];
        writeMeter(meter);
      }
      if (cancelled) return;

      setReadCount(meter.ids.length);
      // 한도를 '넘어선' 밈부터 막는다 — 한도째 밈은 끝까지 읽게 둔다
      setBlocked(meter.ids.length > FREE_LIMIT);
    })();

    return () => {
      cancelled = true;
    };
  }, [memeId]);

  if (!blocked) return null;

  const next = encodeURIComponent(pathname || "/");

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="meter-title"
      className="hover-glow-flame fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[min(28rem,calc(100vw-2rem))] md:-translate-x-1/2 md:rounded-2xl md:border"
    >
      <div className="mx-auto max-w-2xl px-5 py-4">
        <p id="meter-title" className="text-base font-bold">
          오늘 {readCount - 1}개의 밈을 보셨어요
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          로그인하면 밈을 제한 없이 보고, 마음에 드는 밈을 저장해 다시 찾아볼 수
          있어요. 가입은 무료예요.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/login?next=${next}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.98]"
          >
            무료로 계속 보기
          </Link>
          <Link
            href="/explore"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-muted transition-colors hover:text-accent"
          >
            둘러보기
          </Link>
        </div>
      </div>
    </div>
  );
}
