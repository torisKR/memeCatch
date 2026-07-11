"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { TrackedBlock } from "@/components/tracked-block";

const RECENT_KEY = "mc_recent_memes";

/**
 * 이어보기 줄 (Wave 1 / D2) — localStorage의 최근 본 밈을 홈에 가로 스트립으로.
 * 기록 없으면 렌더 안 함(빈 자리 없음). anon 클라이언트로 id 조회(SSR 무관).
 */
export function ResumeStrip() {
  const [memes, setMemes] = useState<MemeListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(ids) || ids.length === 0) return;
        const { data } = await createClient()
          .from("memes")
          .select("*, meme_contents(thumbnail_url, is_representative)")
          .in("id", ids.slice(0, 6))
          .in("moderation_status", ["approved", "limited"]);
        if (cancelled || !data) return;
        // localStorage 순서(최신 앞) 유지
        const byId = new Map((data as MemeListItem[]).map((m) => [m.id, m]));
        setMemes(ids.map((id) => byId.get(id)).filter((m): m is MemeListItem => !!m));
      } catch {
        /* 이어보기 실패는 조용히 숨김 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (memes.length === 0) return null;

  return (
    <section aria-labelledby="resume-strip" className="mt-8">
      <h2 id="resume-strip" className="text-xl font-bold">
        보던 밈 이어보기
      </h2>
      <TrackedBlock event="resume_click">
        <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {memes.map((meme) => (
            <li key={meme.id} className="w-40 shrink-0 snap-start">
              <MemeCard meme={meme} />
            </li>
          ))}
        </ul>
      </TrackedBlock>
    </section>
  );
}
