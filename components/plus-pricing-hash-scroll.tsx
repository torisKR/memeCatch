"use client";

import { useEffect } from "react";
import { PLUS_PRICING_ID, visiblePlusPricingSlot } from "@/lib/plus-pricing-target";

/**
 * `#plus-pricing-title` is the recovery hash. The desktop heading that owns
 * that id is `display: none` on a phone, so scroll the slot that is actually
 * rendered at this width.
 */
export function PlusPricingHashScroll() {
  useEffect(() => {
    const scrollToVisible = () => {
      if (window.location.hash !== `#${PLUS_PRICING_ID}`) return;
      const slots = [...document.querySelectorAll<HTMLElement>("[data-plus-pricing-slot]")];
      visiblePlusPricingSlot(slots, window.innerWidth)?.scrollIntoView({ block: "start" });
    };

    scrollToVisible();
    window.addEventListener("hashchange", scrollToVisible);
    return () => window.removeEventListener("hashchange", scrollToVisible);
  }, []);

  return null;
}
