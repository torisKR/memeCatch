"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { MemeGridSkeleton } from "@/components/skeletons";
import { TrackedBlock } from "@/components/tracked-block";
import { useLocale } from "@/lib/i18n-client";
import { MY_COPY } from "@/lib/i18n-my";

const RECENT_KEY = "mc_recent_memes";

/**
 * MY — 최근 본 밈 (레인 C).
 * ViewTracker(app/memes/[key]/view-tracker.tsx)가 기록해 둔 localStorage id 목록(최대 6)을
 * 브라우저 클라이언트로 조회해 그리드로 보여준다. 기록이 없으면 섹션 자체를 숨긴다.
 * ResumeStrip(components/resume-strip.tsx)과 동일한 RECENT_KEY·조회 패턴을 공유한다.
 */
export function MyRecent() {
  const { locale } = useLocale();
  const copy = MY_COPY[locale].recent;
  const [memes, setMemes] = useState<MemeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(ids) || ids.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data } = await createClient()
          .from("memes")
          .select("*, meme_contents(thumbnail_url, is_representative)")
          .in("id", ids.slice(0, 6))
          .in("moderation_status", ["approved", "limited"]);
        if (cancelled) return;
        const byId = new Map((data as MemeListItem[] | null ?? []).map((m) => [m.id, m]));
        setMemes(ids.map((id) => byId.get(id)).filter((m): m is MemeListItem => !!m));
      } catch {
        /* 최근 본 밈 조회 실패는 조용히 숨김 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function clearAll() {
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch {
      /* 저장 공간 접근 실패는 무시 — 화면 상태만 비운다 */
    }
    setMemes([]);
  }

  if (loading) {
    return (
      <section className="mt-8" aria-busy>
        <h2 className="text-lg font-bold">{copy.title}</h2>
        <div className="mt-3">
          <MemeGridSkeleton count={4} />
        </div>
      </section>
    );
  }

  // 기록 없음 — 섹션 자체를 숨김(빈 자리 없음)
  if (memes.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{copy.title}</h2>
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
        >
          {copy.clearAll}
        </button>
      </div>
      <TrackedBlock event="my_recent_click">
        <MotionList
          as="ul"
          itemAs="li"
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
          itemClassName="min-w-0"
        >
          {memes.map((meme) => (
            <MemeCard key={meme.id} meme={meme} />
          ))}
        </MotionList>
      </TrackedBlock>
    </section>
  );
}
