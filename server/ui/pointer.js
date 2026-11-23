// components/signal-pointer.tsx: cards marked `data-pointer-light` follow a
// mouse pointer (--px/--py and a small tilt); CSS decides what to do.
{
  const MAX_TILT_DEG = 4;
  const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)");
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (fine?.matches && !still?.matches) {
    let frame = 0;
    let active = null;
    const reset = (element) => {
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    };
    document.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const element = event.target instanceof Element ? event.target.closest("[data-pointer-light]") : null;
      if (active && active !== element) reset(active);
      active = element;
      if (!element) return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        element.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
        element.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
        element.style.setProperty("--tilt-x", `${((0.5 - y) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
        element.style.setProperty("--tilt-y", `${((x - 0.5) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      });
    }, { passive: true });
  }
}
