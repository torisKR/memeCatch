"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

const RECENT_KEY = "mc_recent_memes";
const RECENT_MAX = 6;

/**
 * 페이지 진입 시 서버 경유 조회 기록 — 서버가 일 단위 viewer key를 서명하고 DB가 중복을 막는다.
 * Wave 1(D2): 최근 본 밈 id를 localStorage에 기록(최신순, 최대 6) → 홈 "이어보기" 줄.
 */
export function ViewTracker({ memeId }: { memeId: string }) {
  const trackedMemeIds = useRef(new Set<string>());

  useEffect(() => {
    if (!trackedMemeIds.current.has(memeId)) {
      trackedMemeIds.current.add(memeId);
      track("meme_view", { meme_id: memeId });
    }

    try {
      void fetch("/api/memes/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memeId }),
        keepalive: true,
      }).catch(() => {});

      // 최근 본 밈 기록 (중복 제거, 최신 앞)
      const raw = window.localStorage.getItem(RECENT_KEY);
      const prev: string[] = raw ? JSON.parse(raw) : [];
      const next = [memeId, ...prev.filter((id) => id !== memeId)].slice(0, RECENT_MAX);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // 조회수 집계 실패는 조용히 무시
    }
  }, [memeId]);
  return null;
}
