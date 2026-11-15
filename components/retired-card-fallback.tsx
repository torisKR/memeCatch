/**
 * Charcoal field and orange speech bubble used when a 410 card has no verified image.
 * The bubble matches the shared card's fallback so a missing photo never shows a broken icon.
 */
export function RetiredCardFallback() {
  return (
    <div aria-hidden data-meme-card-art="fallback" className="absolute inset-0 overflow-hidden bg-[#141414]">
      <svg viewBox="0 0 120 80" className="absolute left-6 top-6 h-[38%] w-[58%]" focusable="false">
        <path
          fill="#ff5c38"
          d="M8 6h78a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H42L26 74V58H8a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z"
        />
      </svg>
    </div>
  );
}
