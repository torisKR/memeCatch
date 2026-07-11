/**
 * Catch Signal — 밈을 포착(C)하고 사용 신호(dot)를 판정하는 밈캐치 심볼.
 * 불꽃은 생명 게이지에만 남기고, 브랜드 마크는 검색/포착의 의미를 담당한다.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden
    >
      <path
        d="M41.5 14.5c-4-2.7-8.7-4-13.9-4C15.8 10.5 6.5 20.1 6.5 32s9.3 21.5 21.1 21.5c5.2 0 9.9-1.3 13.9-4"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="45.5" cy="32" r="4.6" fill="var(--brand-signal, var(--accent))" />
    </svg>
  );
}

/** 앱 아이콘과 같은 타일형 표현. 작은 브랜드 표면에서 일관되게 사용한다. */
export function BrandTile({ className = "size-8" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-[30%] bg-accent text-ink ${className}`}
    >
      <BrandMark className="size-3/4 [--brand-signal:var(--flame-50)]" />
    </span>
  );
}
