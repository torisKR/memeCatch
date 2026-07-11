"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const SESSION_KEY = "mc_session_hash";
const RECENT_KEY = "mc_recent_memes";
const RECENT_MAX = 6;

/**
 * 페이지 진입 시 increment_view RPC — 세션 해시는 localStorage에 보관(일 단위 dedup은 서버가 처리).
 * Wave 1(D2): 최근 본 밈 id를 localStorage에 기록(최신순, 최대 6) → 홈 "이어보기" 줄.
 */
export function ViewTracker({ memeId }: { memeId: string }) {
  useEffect(() => {
    try {
      let hash = window.localStorage.getItem(SESSION_KEY);
      if (!hash) {
        hash = crypto.randomUUID();
        window.localStorage.setItem(SESSION_KEY, hash);
      }
      void createClient().rpc("increment_view", {
        p_meme_id: memeId,
        p_session_hash: hash,
      });

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
