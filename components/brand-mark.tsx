/**
 * Meme Signal — 밈캐치 브랜드 심볼 (2026-07-12 브랜드 확정안 B).
 * 말풍선(밈·유행어 사전) 안의 신호 dot(지금 써도 되는지 판정) + 펄스(뜻풀이).
 * 불꽃은 생명 게이지 UI 전용으로 분리 — 심볼은 "판정하는 사전"을 담당한다.
 * 자산: public/brand/*.svg (라이트/다크/영문/단색/파비콘 규칙)
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M14 8h36a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H26L10 60c-3 2.4-6-.2-6-3V18A10 10 0 0 1 14 8Z"
      />
      <circle cx="41" cy="29" r="7.5" fill="var(--brand-dot, var(--surface, #FFF9F5))" />
      <path
        d="M15 29h11"
        stroke="var(--brand-dot, var(--surface, #FFF9F5))"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 앱 아이콘과 같은 타일형 표현. 작은 브랜드 표면에서 일관되게 사용한다. */
export function BrandTile({ className = "size-8" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-[30%] bg-accent ${className}`}
    >
      <svg viewBox="0 0 64 64" className="h-[72%] w-[72%]" fill="none">
        <path
          fill="#FFF9F5"
          d="M14 8h36a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H26L10 60c-3 2.4-6-.2-6-3V18A10 10 0 0 1 14 8Z"
        />
        <circle cx="41" cy="29" r="7.5" fill="var(--accent, #FF5A1F)" />
        <path
          d="M15 29h11"
          stroke="var(--accent, #FF5A1F)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
