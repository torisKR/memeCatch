export const PLUS_PRICING_ID = "plus-pricing-title";
export const PLUS_PRICING_DESKTOP_MIN = 1024;

function hasClass(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token);
}

/**
 * Desktop Plus lives in `hidden lg:block`. Mobile Plus lives in `lg:hidden`.
 * `lg:hidden` must not count as the Tailwind `hidden` token.
 */
export function plusPricingSlotHidden(className: string, viewportWidth: number): boolean {
  if (viewportWidth >= PLUS_PRICING_DESKTOP_MIN) return hasClass(className, "lg:hidden");
  return hasClass(className, "hidden");
}

export function visiblePlusPricingSlot<T extends { className: string }>(
  slots: readonly T[],
  viewportWidth: number,
): T | null {
  return slots.find((slot) => !plusPricingSlotHidden(slot.className, viewportWidth)) ?? null;
}
