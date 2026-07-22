/**
 * Catch Signal — 밈캐치 브랜드 심볼 v2 (2026-07 리뉴얼 리파인).
 * C 링(밈을 포착하는 레이더/캐치) + 링 갭에 잡힌 신호 dot(지금 써도 되는지 판정)
 * + 말풍선 꼬리(밈·유행어 사전). 네거티브 스페이스가 알파벳 C를 이룬다.
 * 2026-07-12 확정안 B(말풍선+신호 dot)의 의미 체계를 계승한 진화형.
 * 자산: public/brand/*.svg (라이트/다크/영문/단색/파비콘 규칙)
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path
        d="M 37.4 11.7 A 21 21 0 1 0 52.9 33.8"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="49.2" cy="20" r="5.5" fill="currentColor" />
      <path fill="currentColor" d="M14.5 44.5 10.5 58.5 25.5 53.5Z" />
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
      <svg viewBox="0 0 64 64" className="h-[74%] w-[74%]" fill="none">
        <path
          d="M 37.4 11.7 A 21 21 0 1 0 52.9 33.8"
          stroke="#FFF9F5"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle cx="49.2" cy="20" r="6" fill="#FFF9F5" />
        <path fill="#FFF9F5" d="M14.5 44.5 10.5 58.5 25.5 53.5Z" />
      </svg>
    </span>
  );
}
