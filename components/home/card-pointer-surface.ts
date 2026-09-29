const MAX_TILT_DEGREES = 4;
const CARD_SELECTOR = "[data-interactive-card]";

type InteractiveCard = HTMLElement & {
  dataset: DOMStringMap & {
    pointerActive?: string;
    tilt?: string;
  };
};

function resetCard(card: InteractiveCard) {
  card.style.removeProperty("--card-tilt-x");
  card.style.removeProperty("--card-tilt-y");
  card.style.removeProperty("--card-light-x");
  card.style.removeProperty("--card-light-y");
  delete card.dataset.pointerActive;
  card.dataset.tilt = "0,0";
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Adds a bounded, DOM-only pointer response to the cards currently inside root.
 * It never captures the pointer or prevents defaults, so links and touch scrolling
 * retain their native behavior.
 */
export function mountCardPointerSurface(root: HTMLElement): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;

  const finePointer = window.matchMedia("(pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cards = [...root.querySelectorAll<InteractiveCard>(CARD_SELECTOR)];
  const canRespond = () => finePointer.matches && !reducedMotion.matches;

  function resetAll() {
    cards.forEach(resetCard);
  }

  function onPointerMove(this: InteractiveCard, event: PointerEvent) {
    if (!canRespond() || event.pointerType !== "mouse") return;

    const bounds = this.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      resetCard(this);
      return;
    }

    const x = clampUnit((event.clientX - bounds.left) / bounds.width);
    const y = clampUnit((event.clientY - bounds.top) / bounds.height);
    const tiltX = (0.5 - y) * MAX_TILT_DEGREES * 2;
    const tiltY = (x - 0.5) * MAX_TILT_DEGREES * 2;

    this.style.setProperty("--card-tilt-x", `${tiltX.toFixed(2)}deg`);
    this.style.setProperty("--card-tilt-y", `${tiltY.toFixed(2)}deg`);
    this.style.setProperty("--card-light-x", `${(x * 100).toFixed(2)}%`);
    this.style.setProperty("--card-light-y", `${(y * 100).toFixed(2)}%`);
    this.dataset.pointerActive = "true";
    this.dataset.tilt = `${tiltX.toFixed(2)},${tiltY.toFixed(2)}`;
  }

  function onPointerLeave(this: InteractiveCard) {
    resetCard(this);
  }

  for (const card of cards) {
    card.addEventListener("pointermove", onPointerMove);
    card.addEventListener("pointerleave", onPointerLeave);
  }
  finePointer.addEventListener("change", resetAll);
  reducedMotion.addEventListener("change", resetAll);

  return () => {
    resetAll();
    for (const card of cards) {
      card.removeEventListener("pointermove", onPointerMove);
      card.removeEventListener("pointerleave", onPointerLeave);
    }
    finePointer.removeEventListener("change", resetAll);
    reducedMotion.removeEventListener("change", resetAll);
  };
}
