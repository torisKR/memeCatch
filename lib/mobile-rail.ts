/** Shared class for a horizontal rail that must not become the page scroller. */
export const H_RAIL_CLASS = "h-rail";

/** How far a horizontal rail can move to show its last item. */
export function railScrollEnd(scrollWidth: number, clientWidth: number): number {
  return Math.max(0, scrollWidth - clientWidth);
}

export function railAtEnd(scrollWidth: number, clientWidth: number, scrollLeft: number): boolean {
  return scrollLeft >= railScrollEnd(scrollWidth, clientWidth) - 1;
}

/** `auto`/`scroll` on the block axis captures a vertical swipe inside the rail. */
export function railCapturesVerticalScroll(overflowY: string): boolean {
  return overflowY === "auto" || overflowY === "scroll";
}

export function bodyHorizontalOverflow(scrollWidth: number, clientWidth: number): number {
  return Math.max(0, scrollWidth - clientWidth);
}
