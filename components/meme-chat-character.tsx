import styles from "./meme-chatbot.module.css";

export type MemeChatCharacterState = "idle" | "reading" | "searching" | "found" | "answering" | "ready";

export function MemeChatCharacter({ state = "idle", size = 52 }: { state?: MemeChatCharacterState; size?: number }) {
  return (
    <span className={styles.character} data-character-state={state} aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 88 88" width={size} height={size} focusable="false">
        <ellipse cx="44" cy="79" rx="24" ry="3" fill="var(--foreground)" opacity=".08" />
        <g className={styles.body}>
          <path d="M22 48c-9 0-12 5-10 11M66 48c9 0 12 5 10 11" fill="none" stroke="var(--accent-strong)" strokeWidth="7" strokeLinecap="round" />
          <path d="M28 70v6M60 70v6" fill="none" stroke="var(--accent-strong)" strokeWidth="11" strokeLinecap="round" />
          <path d="M19 35c0-12 10-21 25-21 15 0 25 9 25 21v24c0 10-9 16-21 16H31l-9 5 2-12c-4-4-5-8-5-15Z" fill="var(--accent)" />
          <path d="M34 18c1-7 7-8 10-15 5 5 9 10 6 16" fill="var(--accent)" />
          <path d="M26 27c5-5 11-7 18-7" fill="none" stroke="var(--surface)" strokeWidth="3" strokeLinecap="round" opacity=".65" />
          <rect x="24" y="32" width="40" height="31" rx="13" fill="var(--surface)" />
          <g className={styles.eyes}>
            <ellipse cx="35" cy="45" rx="3.1" ry="4.1" fill="var(--foreground)" />
            <ellipse cx="53" cy="45" rx="3.1" ry="4.1" fill="var(--foreground)" />
          </g>
          <path d="M40 54q4 4 8 0" fill="none" stroke="var(--foreground)" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="29" cy="52" rx="3.4" ry="2" fill="var(--accent)" opacity=".3" />
          <ellipse cx="59" cy="52" rx="3.4" ry="2" fill="var(--accent)" opacity=".3" />
          <g className={styles.hand}>
            <path d="M67 48q9-2 9-10" fill="none" stroke="var(--accent-strong)" strokeWidth="7" strokeLinecap="round" />
            <circle cx="76" cy="36" r="5" fill="var(--accent)" />
          </g>
        </g>
        {state === "reading" && (
          <g className={styles.prop}>
            <path d="M25 60q10-3 19 1 9-4 19-1v13q-10-3-19 1-9-4-19-1Z" fill="var(--surface)" stroke="var(--accent-strong)" strokeWidth="1.5" />
            <path d="M44 61v13M30 64h8M50 64h8M30 68h7M50 68h7" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        )}
        {state === "searching" && (
          <g className={styles.searchProp}>
            <circle cx="64" cy="58" r="10" fill="var(--surface)" stroke="var(--foreground)" strokeWidth="3" />
            <path d="m71 65 7 7" stroke="var(--foreground)" strokeWidth="5" strokeLinecap="round" />
            <path d="M59 56q1-4 5-4" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {(state === "found" || state === "ready") && (
          <g className={styles.prop}>
            <circle cx="70" cy="22" r="11" fill="var(--safety-green-bg)" stroke="var(--safety-green)" strokeWidth="1.5" />
            <path d="m65 22 3 3 6-7" fill="none" stroke="var(--safety-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {state === "answering" && (
          <g className={styles.prop}>
            <rect x="49" y="7" width="32" height="18" rx="8" fill="var(--surface)" stroke="var(--border)" />
            <path d="m57 24-3 5 9-5" fill="var(--surface)" />
            <circle cx="57" cy="16" r="2" fill="var(--accent-strong)" />
            <circle cx="65" cy="16" r="2" fill="var(--accent-strong)" />
            <circle cx="73" cy="16" r="2" fill="var(--accent-strong)" />
          </g>
        )}
      </svg>
    </span>
  );
}
