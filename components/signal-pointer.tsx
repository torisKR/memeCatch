"use client";

import { useEffect } from "react";

/** Past this the tilt reads as a gimmick and makes the title harder to read. */
const MAX_TILT_DEG = 4;
const TARGET = "[data-pointer-light]";

/**
 * One document listener for every card marked `data-pointer-light`. It writes
 * the pointer position (--px/--py) and a small tilt (--tilt-x/--tilt-y) to the
 * card under the mouse; CSS decides what to do with them. A listener per card
 * would cost one handler for each of the hundreds of cards in an infinite grid.
 * Touch input and reduced motion never start it.
 */
export function SignalPointer() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let active: HTMLElement | null = null;

    const reset = (el: HTMLElement) => {
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const el = (event.target as Element | null)?.closest<HTMLElement>(TARGET) ?? null;
      if (active && active !== el) reset(active);
      active = el;
      if (!el) return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        el.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
        el.style.setProperty("--tilt-x", `${((0.5 - y) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${((x - 0.5) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      });
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      if (active) reset(active);
    };
  }, []);

  return null;
}
