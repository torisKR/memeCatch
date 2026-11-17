"use client";

import { useState } from "react";
import { BookOpen, Check, MessageCircle, Search } from "lucide-react";
import styles from "./meme-chatbot.module.css";

export type MemeChatCharacterState = "idle" | "reading" | "searching" | "found" | "answering" | "ready";
const STILL = "/images/meme-chat/mascot-idle.png";
const LOOP = "/images/meme-chat/mascot-wave.gif";

export function MemeChatCharacter({ state = "idle", size = 52 }: { state?: MemeChatCharacterState; size?: number }) {
  const [failed, setFailed] = useState(false);
  const animated = !failed && state !== "ready" && state !== "found";
  const StatusIcon = state === "reading" ? BookOpen : state === "searching" ? Search :
    state === "answering" ? MessageCircle : state === "ready" || state === "found" ? Check : null;
  return (
    <span className={styles.character} data-character-state={state} aria-hidden="true" style={{ width: size, height: size }}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={STILL} />
        {/* Generated animation is served directly; image optimization would remove its frames. */}
        <img src={animated ? LOOP : STILL} alt="" width={size} height={size}
          className={styles.characterImage} decoding="async" draggable={false}
          onError={() => setFailed(true)} />
      </picture>
      {StatusIcon && <span className={styles.characterState}><StatusIcon size={10} strokeWidth={2.5} /></span>}
    </span>
  );
}
