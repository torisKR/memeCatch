"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const SESSION_KEY = "mc_session_hash";

/** 페이지 진입 시 increment_view RPC — 세션 해시는 localStorage에 보관(일 단위 dedup은 서버가 처리) */
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
    } catch {
      // 조회수 집계 실패는 조용히 무시
    }
  }, [memeId]);
  return null;
}
