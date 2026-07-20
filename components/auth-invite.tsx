"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 상세 진입 유도 카드 — 밈 상세로 들어온 방문자에게 로그인/회원가입을 권한다.
 *
 * SEO·SSG 원칙(MeteredGate와 동일):
 * - 서버는 누구에게나 **동일한 HTML**을 보낸다. 로그인 여부 판정은 전적으로
 *   클라이언트에서만 하므로 클로킹이 아니며 색인·SSG에 영향이 없다.
 * - Googlebot에는 세션이 없어 항상 이 카드가 보이지만, 이는 정적 페이지의
 *   부가 안내일 뿐이라 순위에 무해하다.
 * - 로그인한 사용자에겐 아예 렌더하지 않는다(이미 전환된 사용자에게 무의미).
 * - 세션 확인 전(status="pending")에는 렌더하지 않아 깜빡임(FOUC)을 막는다.
 *
 * MeteredGate(한도 초과 시 하단 시트)와 역할이 다르다: 이 카드는 상세 본문
 * 위쪽, 정답 카드 직후에 절제된 1회 인라인 안내로 부드럽게 가입을 권한다.
 */

type SessionStatus = "pending" | "guest" | "member";

export function AuthInvite() {
  const [status, setStatus] = useState<SessionStatus>("pending");
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (cancelled) return;
      setStatus(session ? "member" : "guest");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 로그인 사용자·판정 전에는 렌더하지 않는다(SSG HTML은 동일, 깜빡임 방지)
  if (status !== "guest") return null;

  const next = encodeURIComponent(pathname || "/");

  return (
    <aside
      aria-label="로그인 안내"
      className="overflow-hidden rounded-2xl border border-accent/25 bg-accent-soft/50"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"
          >
            <SparkGlyph />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold">
              로그인하면 밈캐치를 200% 즐길 수 있어요
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              마음에 드는 밈을 저장하고, 직접 제보하고, 매일 새로운 밈을 놓치지
              마세요. 가입은 무료예요.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/login?next=${next}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent sm:flex-none"
          >
            로그인
          </Link>
          <Link
            href={`/login?tab=signup&next=${next}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-none"
          >
            회원가입
          </Link>
        </div>
      </div>
    </aside>
  );
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.9a2 2 0 0 0 1.27 1.27L21 11l-5.83 1.9a2 2 0 0 0-1.27 1.27L12 20l-1.9-5.83a2 2 0 0 0-1.27-1.27L3 11l5.83-1.83A2 2 0 0 0 10.1 7.9L12 2Z" />
    </svg>
  );
}
